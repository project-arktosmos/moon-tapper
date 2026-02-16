<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	export let coverURL: string = '';
	export let songName: string;
	export let songAuthorName: string;
	export let levelAuthorName: string = '';
	export let bpm: number;
	export let duration: number;
	export let diffs: { difficulty: string }[] = [];
	export let selectedDifficulty: string = '';

	const dispatch = createEventDispatcher<{
		diffSelect: { difficulty: string };
		play: void;
	}>();

	const diffColors: Record<string, string> = {
		Easy: 'badge-success',
		Normal: 'badge-info',
		Hard: 'badge-warning',
		Expert: 'badge-error',
		ExpertPlus: 'badge-secondary'
	};

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="card bg-base-200 shadow-md">
	{#if coverURL}
		<figure class="aspect-square">
			<img
				src={coverURL}
				alt={songName}
				class="h-full w-full object-cover"
			/>
		</figure>
	{/if}
	<div class="card-body gap-1 p-4">
		<h3 class="card-title text-base line-clamp-1">{songName}</h3>
		<p class="text-sm opacity-60 line-clamp-1">
			{songAuthorName}
			{#if levelAuthorName}
				<span class="opacity-40">/ mapped by {levelAuthorName}</span>
			{/if}
		</p>
		<div class="flex flex-wrap items-center gap-1">
			<span class="badge badge-ghost badge-sm">{Math.round(bpm)} BPM</span>
			<span class="badge badge-ghost badge-sm">{formatDuration(duration)}</span>
			<slot name="badges" />
		</div>
		<div class="flex flex-wrap items-center gap-1">
			{#each diffs as diff}
				<button
					class={classNames('badge badge-sm cursor-pointer', diffColors[diff.difficulty] || 'badge-neutral', {
						'badge-outline': diff.difficulty !== selectedDifficulty
					})}
					on:click={() => dispatch('diffSelect', { difficulty: diff.difficulty })}
				>
					{diff.difficulty === 'ExpertPlus' ? 'Expert+' : diff.difficulty}
				</button>
			{/each}
		</div>
		<div class="card-actions mt-1 justify-end items-center">
			<slot name="actions" />
			<Button
				label={$_('rhythm.play')}
				color={ThemeColors.Primary}
				size={ThemeSizes.Small}
				on:click={() => dispatch('play')}
			/>
		</div>
	</div>
</div>
