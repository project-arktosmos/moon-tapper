<script lang="ts">
	import classNames from 'classnames';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { rhythmScoresService } from '$services/rhythm-scores.service';
	import type { RhythmScore } from '$types/rhythm.type';

	const scoresStore = rhythmScoresService.store;

	let confirmClear = $state(false);

	let sortedScores: RhythmScore[] = $derived(
		[...$scoresStore].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	);

	const gradeColors: Record<string, string> = {
		S: 'text-warning',
		A: 'text-success',
		B: 'text-info',
		C: 'text-primary',
		D: 'text-error'
	};

	function getAccuracy(score: RhythmScore): number {
		const total = score.perfect + score.good + score.miss;
		if (total === 0) return 0;
		return Math.round(((score.perfect + score.good * 0.5) / total) * 100);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleClearAll() {
		sortedScores.forEach((score) => rhythmScoresService.remove(score));
		confirmClear = false;
	}
</script>

<div class="flex flex-col gap-4">
	{#if sortedScores.length > 0}
		<div class="flex justify-end">
			{#if confirmClear}
				<div class="flex items-center gap-2">
					<span class="text-sm text-error">Delete all scores?</span>
					<Button
						label="Delete"
						color={ThemeColors.Error}
						size={ThemeSizes.Small}
						on:click={handleClearAll}
					/>
					<Button
						label="Cancel"
						color={ThemeColors.Neutral}
						size={ThemeSizes.Small}
						outline
						on:click={() => (confirmClear = false)}
					/>
				</div>
			{:else}
				<Button
					label="Clear All Scores"
					color={ThemeColors.Error}
					size={ThemeSizes.Small}
					outline
					on:click={() => (confirmClear = true)}
				/>
			{/if}
		</div>
	{/if}

	{#if sortedScores.length === 0}
		<div class="py-16 text-center opacity-60">
			No scores yet. Play some songs to see your history!
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Song</th>
						<th>Difficulty</th>
						<th>Grade</th>
						<th>Score</th>
						<th>Max Combo</th>
						<th>Accuracy</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedScores as score (score.id)}
						<tr class="hover">
							<td class="font-medium">{score.mapName}</td>
							<td>{score.difficulty}</td>
							<td>
								<span class={classNames('text-xl font-bold', gradeColors[score.grade] || '')}>
									{score.grade}
								</span>
							</td>
							<td class="tabular-nums">{score.score.toLocaleString()}</td>
							<td class="tabular-nums">{score.maxCombo}x</td>
							<td class="tabular-nums">{getAccuracy(score)}%</td>
							<td class="text-sm opacity-70">{formatDate(score.date)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
