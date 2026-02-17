<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import Button from '$components/core/Button.svelte';
	import LaneBindingsInline from '$components/core/LaneBindingsInline.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { BeatSaverMap, BeatSaverDiff, LaneMode, GameMode } from '$types/rhythm.type';

	export let map: BeatSaverMap;
	export let selectedDifficulty: string;
	export let laneMode: LaneMode = 4;
	export let gameMode: GameMode = 'single';

	const dispatch = createEventDispatcher<{
		difficultyChange: { difficulty: string };
		laneModeChange: { laneMode: LaneMode };
		gameModeChange: { gameMode: GameMode };
		startPlay: void;
		back: void;
	}>();

	const diffButtonColors: Record<string, string> = {
		Easy: 'btn-success',
		Normal: 'btn-info',
		Hard: 'btn-warning',
		Expert: 'btn-error',
		ExpertPlus: 'btn-secondary'
	};

	function getDiffs(): BeatSaverDiff[] {
		const diffs = map.versions?.[0]?.diffs || [];
		const standard = diffs.filter((d) => d.characteristic === 'Standard');
		const filtered = standard.length > 0 ? standard : diffs;
		const seen = new Set<string>();
		return filtered.filter((d) => {
			if (seen.has(d.difficulty)) return false;
			seen.add(d.difficulty);
			return true;
		});
	}
</script>

<div class="flex flex-col items-center gap-6 py-10">
	<div class="flex items-center gap-4">
		{#if map.versions?.[0]?.coverURL}
			<img
				src={map.versions[0].coverURL}
				alt={map.metadata.songName}
				class="h-24 w-24 rounded-lg object-cover shadow-lg"
			/>
		{/if}
		<div>
			<h2 class="text-2xl font-bold">{map.metadata.songName}</h2>
			<p class="opacity-60">{map.metadata.songAuthorName}</p>
		</div>
	</div>

	<div class="flex flex-col items-center gap-2">
		<p class="text-sm font-semibold uppercase tracking-wide opacity-60">
			Select Difficulty
		</p>
		<div class="flex gap-2">
			{#each getDiffs() as diff}
				<button
					class={classNames('btn btn-sm', {
						[diffButtonColors[diff.difficulty] || 'btn-neutral']:
							diff.difficulty === selectedDifficulty,
						'btn-outline btn-ghost': diff.difficulty !== selectedDifficulty
					})}
					onclick={() => dispatch('difficultyChange', { difficulty: diff.difficulty })}
				>
					{diff.difficulty === 'ExpertPlus' ? 'Expert+' : diff.difficulty}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-col items-center gap-2">
		<p class="text-sm font-semibold uppercase tracking-wide opacity-60">
			Lane Mode
		</p>
		<div class="join">
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-primary': laneMode === 2,
					'btn-ghost btn-outline': laneMode !== 2
				})}
				onclick={() => dispatch('laneModeChange', { laneMode: 2 })}
			>
				2 Lanes
			</button>
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-primary': laneMode === 3,
					'btn-ghost btn-outline': laneMode !== 3
				})}
				onclick={() => dispatch('laneModeChange', { laneMode: 3 })}
			>
				3 Lanes
			</button>
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-primary': laneMode === 4,
					'btn-ghost btn-outline': laneMode !== 4
				})}
				onclick={() => dispatch('laneModeChange', { laneMode: 4 })}
			>
				4 Lanes
			</button>
		</div>
	</div>

	<LaneBindingsInline {laneMode} {gameMode} />

	<div class="flex flex-col items-center gap-2">
		<p class="text-sm font-semibold uppercase tracking-wide opacity-60">
			Game Mode
		</p>
		<div class="join">
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-accent': gameMode === 'single',
					'btn-ghost btn-outline': gameMode !== 'single'
				})}
				onclick={() => dispatch('gameModeChange', { gameMode: 'single' })}
			>
				Single
			</button>
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-accent': gameMode === 'duel',
					'btn-ghost btn-outline': gameMode !== 'duel'
				})}
				onclick={() => dispatch('gameModeChange', { gameMode: 'duel' })}
			>
				Duel
			</button>
		</div>
	</div>

	<div class="flex flex-col items-center gap-3">
		<Button
			label="Play"
			color={ThemeColors.Primary}
			size={ThemeSizes.Large}
			on:click={() => dispatch('startPlay')}
		/>
	</div>

	<Button
		label="Back to Browse"
		color={ThemeColors.Neutral}
		outline
		size={ThemeSizes.Small}
		on:click={() => dispatch('back')}
	/>
</div>
