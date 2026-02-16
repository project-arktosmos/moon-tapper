<script lang="ts">
	import classNames from 'classnames';
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { RhythmGameState } from '$types/rhythm.type';
	import { beatsaverAdapter } from '$adapters/classes/beatsaver.adapter';

	interface Props {
		gameState: RhythmGameState;
		songName?: string;
		difficulty?: string;
		saved?: boolean;
		onsave?: () => void;
		onplayAgain?: () => void;
		onbrowse?: () => void;
	}

	let {
		gameState,
		songName = '',
		difficulty = '',
		saved = false,
		onsave,
		onplayAgain,
		onbrowse
	}: Props = $props();

	let grade = $derived(beatsaverAdapter.calculateGrade(gameState.perfect, gameState.good, gameState.miss));
	let totalNotes = $derived(gameState.perfect + gameState.good + gameState.miss);
	let accuracy = $derived(totalNotes > 0
		? Math.round(((gameState.perfect + gameState.good * 0.5) / totalNotes) * 100)
		: 0
	);

	const gradeColors: Record<string, string> = {
		S: 'text-warning',
		A: 'text-success',
		B: 'text-info',
		C: 'text-primary',
		D: 'text-error'
	};
</script>

<div class="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
	<h2 class="text-2xl font-bold">{$_('rhythm.results')}</h2>

	{#if songName}
		<p class="text-lg opacity-70">{songName} — {difficulty}</p>
	{/if}

	<!-- Grade -->
	<div class={classNames('text-9xl font-black', gradeColors[grade] || 'text-base-content')}>
		{grade}
	</div>

	<!-- Score -->
	<div class="text-4xl font-bold tabular-nums">{gameState.score.toLocaleString()}</div>

	<!-- Stats -->
	<div class="stats stats-vertical w-full shadow lg:stats-horizontal">
		<div class="stat">
			<div class="stat-title">{$_('rhythm.perfect')}</div>
			<div class="stat-value text-warning">{gameState.perfect}</div>
		</div>
		<div class="stat">
			<div class="stat-title">{$_('rhythm.good')}</div>
			<div class="stat-value text-success">{gameState.good}</div>
		</div>
		<div class="stat">
			<div class="stat-title">{$_('rhythm.miss')}</div>
			<div class="stat-value text-error">{gameState.miss}</div>
		</div>
	</div>

	<div class="stats w-full shadow">
		<div class="stat">
			<div class="stat-title">{$_('rhythm.maxCombo')}</div>
			<div class="stat-value">{gameState.maxCombo}x</div>
		</div>
		<div class="stat">
			<div class="stat-title">{$_('rhythm.accuracy')}</div>
			<div class="stat-value">{accuracy}%</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex gap-3">
		{#if !saved}
			<Button
				label={$_('rhythm.saveScore')}
				color={ThemeColors.Success}
				size={ThemeSizes.Medium}
				on:click={() => onsave?.()}
			/>
		{:else}
			<span class="badge badge-success badge-lg">{$_('rhythm.scoreSaved')}</span>
		{/if}
		<Button
			label={$_('rhythm.playAgain')}
			color={ThemeColors.Primary}
			size={ThemeSizes.Medium}
			on:click={() => onplayAgain?.()}
		/>
		<Button
			label={$_('rhythm.backToBrowse')}
			color={ThemeColors.Neutral}
			outline
			size={ThemeSizes.Medium}
			on:click={() => onbrowse?.()}
		/>
	</div>
</div>
