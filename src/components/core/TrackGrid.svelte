<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import TrackItem from '$components/core/TrackItem.svelte';
	import type { PlaylistTrack } from '$types/rhythm.type';

	export let items: PlaylistTrack[] = [];
	export let selectedDiffs: Record<string, string> = {};
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		diffSelect: { id: string; difficulty: string };
		play: { item: PlaylistTrack; difficulty: string };
	}>();

	function getSelectedDiff(item: PlaylistTrack): string {
		return selectedDiffs[item.id] || item.diffs[0]?.difficulty || 'Normal';
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 {classes}">
	{#each items as item (item.id)}
		<TrackItem
			id={item.id}
			coverURL={item.coverURL}
			songName={item.songName}
			songAuthorName={item.songAuthorName}
			levelAuthorName={item.levelAuthorName}
			bpm={item.bpm}
			duration={item.duration}
			diffs={item.diffs}
			selectedDifficulty={getSelectedDiff(item)}
			on:diffSelect={(e) => dispatch('diffSelect', { id: item.id, difficulty: e.detail.difficulty })}
			on:play={() => dispatch('play', { item, difficulty: getSelectedDiff(item) })}
		>
			<svelte:fragment slot="badges">
				<slot name="badges" {item} />
			</svelte:fragment>
			<svelte:fragment slot="actions">
				<slot name="actions" {item} />
			</svelte:fragment>
		</TrackItem>
	{/each}
</div>
