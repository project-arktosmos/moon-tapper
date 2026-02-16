<script lang="ts">
	import { goto } from '$app/navigation';
	import RhythmPlaylistManager from '$components/core/RhythmPlaylistManager.svelte';
	import type { PlaylistTrack } from '$types/rhythm.type';

	function handleTrackSelect(
		e: CustomEvent<{ track: PlaylistTrack; difficulty: string }>
	) {
		const { track, difficulty } = e.detail;
		goto(`/rhythm/play?mapId=${encodeURIComponent(track.id)}&difficulty=${encodeURIComponent(difficulty)}`);
	}
</script>

<RhythmPlaylistManager on:select={handleTrackSelect} />
