<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import RhythmSongBrowser from '$components/core/RhythmSongBrowser.svelte';
	import type { BeatSaverMap } from '$types/rhythm.type';

	function handleMapSelect(
		e: CustomEvent<{ map: BeatSaverMap; difficulty: string }>
	) {
		const { map, difficulty } = e.detail;
		goto(`${base}/rhythm/play?mapId=${encodeURIComponent(map.id)}&difficulty=${encodeURIComponent(difficulty)}`);
	}
</script>

<RhythmSongBrowser on:select={handleMapSelect} />
