<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { BeatSaverMap, BeatSaverDiff, LaneMode } from '$types/rhythm.type';

	export let map: BeatSaverMap;
	export let selectedDifficulty: string;
	export let laneMode: LaneMode = 4;
	export let lyricsReady: boolean = false;

	const dispatch = createEventDispatcher<{
		difficultyChange: { difficulty: string };
		laneModeChange: { laneMode: LaneMode };
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
		return map.versions?.[0]?.diffs || [];
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
			{$_('rhythm.selectDifficulty')}
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
			{$_('rhythm.laneMode')}
		</p>
		<div class="join">
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-primary': laneMode === 4,
					'btn-ghost btn-outline': laneMode !== 4
				})}
				onclick={() => dispatch('laneModeChange', { laneMode: 4 })}
			>
				{$_('rhythm.lanes4')}
			</button>
			<button
				class={classNames('btn btn-sm join-item', {
					'btn-primary': laneMode === 3,
					'btn-ghost btn-outline': laneMode !== 3
				})}
				onclick={() => dispatch('laneModeChange', { laneMode: 3 })}
			>
				{$_('rhythm.lanes3')}
			</button>
		</div>
	</div>

	<div class="flex flex-col items-center gap-3">
		<Button
			label={$_('rhythm.play')}
			color={ThemeColors.Primary}
			size={ThemeSizes.Large}
			disabled={!lyricsReady}
			on:click={() => dispatch('startPlay')}
		/>
		{#if !lyricsReady}
			<div class="flex items-center gap-2">
				<span class="loading loading-spinner loading-sm text-primary"></span>
				<span class="text-sm opacity-60">{$_('rhythm.lyrics.fetching')}</span>
			</div>
		{/if}
	</div>

	<Button
		label={$_('rhythm.backToBrowse')}
		color={ThemeColors.Neutral}
		outline
		size={ThemeSizes.Small}
		on:click={() => dispatch('back')}
	/>
</div>
