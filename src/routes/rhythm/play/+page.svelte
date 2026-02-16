<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import RhythmGame from '$components/core/RhythmGame.svelte';
	import RhythmResults from '$components/core/RhythmResults.svelte';
	import RhythmLyricsPanel from '$components/core/RhythmLyricsPanel.svelte';
	import RhythmDifficultySelect from '$components/core/RhythmDifficultySelect.svelte';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { beatsaverApi } from '$api/beatsaver';
	import { beatsaverAdapter } from '$adapters/classes/beatsaver.adapter';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { rhythmScoresService } from '$services/rhythm-scores.service';
	import { lyricsService } from '$services/lyrics.service';
	import type {
		BeatSaverMap,
		BeatSaverMapExtracted,
		BeatMap,
		BeatMapInfo,
		RhythmGameState,
		GameSessionState,
		RhythmScore
	} from '$types/rhythm.type';

	let sessionState: GameSessionState = $state('loading');
	let error: string | null = $state(null);
	let loadingProgress: string = $state('');

	// Selected map
	let selectedMap: BeatSaverMap | null = $state(null);
	let selectedDifficulty: string = $state('');

	// Loaded data for game
	let beatMap: BeatMap | null = $state(null);
	let audioBase64: string = $state('');
	let mapInfo: BeatMapInfo | null = $state(null);

	// Results
	let finalState: RhythmGameState | null = $state(null);
	let scoreSaved = $state(false);

	// Lyrics playback time
	let gameCurrentTime: number = $state(0);

	// Extracted data for difficulty switching
	let extractedData: BeatSaverMapExtracted | null = $state(null);
	let lyricsReady = $state(false);

	// Settings
	let settings = rhythmSettingsService.get();

	function parseDifficulty(difficulty: string) {
		if (!mapInfo || !extractedData) return;

		const diffSet =
			mapInfo.difficultyBeatmapSets.find((s) => s.characteristicName === 'Standard') ||
			mapInfo.difficultyBeatmapSets[0];

		const diffEntry =
			diffSet?.difficultyBeatmaps.find((d) => d.difficulty === difficulty) ||
			diffSet?.difficultyBeatmaps[0];

		if (!diffEntry) throw new Error('Difficulty not found');

		const beatmapJson = Object.entries(extractedData.beatmaps).find(
			([key]) => key.toLowerCase() === diffEntry.beatmapFilename.toLowerCase()
		)?.[1];

		if (!beatmapJson)
			throw new Error(`Beatmap file ${diffEntry.beatmapFilename} not found`);

		beatMap = beatsaverAdapter.parseBeatMap(beatmapJson, mapInfo.bpm);
		audioBase64 = extractedData.audio_base64;
	}

	function handleDifficultyChange(e: CustomEvent<{ difficulty: string }>) {
		selectedDifficulty = e.detail.difficulty;
		try {
			parseDifficulty(e.detail.difficulty);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function handleStartPlay() {
		gameCurrentTime = 0;
		sessionState = 'playing';
	}

	function handleGameFinish(detail: { state: RhythmGameState }) {
		finalState = detail.state;
		sessionState = 'results';
	}

	function handleTimeUpdate(time: number) {
		gameCurrentTime = time;
	}

	function handleSaveScore() {
		if (!finalState || !selectedMap) return;
		const grade = beatsaverAdapter.calculateGrade(
			finalState.perfect,
			finalState.good,
			finalState.miss
		);
		const score: RhythmScore = {
			id: `${selectedMap.id}-${selectedDifficulty}-${Date.now()}`,
			mapId: selectedMap.id,
			mapName: selectedMap.metadata.songName,
			difficulty: selectedDifficulty,
			score: finalState.score,
			maxCombo: finalState.maxCombo,
			perfect: finalState.perfect,
			good: finalState.good,
			miss: finalState.miss,
			grade,
			date: new Date().toISOString()
		};
		rhythmScoresService.add(score);
		scoreSaved = true;
	}

	function handlePlayAgain() {
		if (beatMap && audioBase64) {
			scoreSaved = false;
			finalState = null;
			gameCurrentTime = 0;
			sessionState = 'playing';
		}
	}

	function handleBackToBrowse() {
		lyricsService.clear();
		goto('/rhythm');
	}

	onMount(async () => {
		const mapId = $page.url.searchParams.get('mapId');
		const difficulty = $page.url.searchParams.get('difficulty') || 'Normal';

		if (!mapId) {
			goto('/rhythm');
			return;
		}

		selectedDifficulty = difficulty;

		try {
			loadingProgress = $_('rhythm.downloading');
			const map = await beatsaverApi.getMapById(mapId);
			selectedMap = map;

			const version = map.versions?.[0];
			if (!version) throw new Error('No version available');

			const extracted = await beatsaverApi.downloadMap(version.downloadURL, map.id);

			loadingProgress = $_('rhythm.parsing');
			mapInfo = beatsaverAdapter.parseInfoDat(extracted.info_dat);
			extractedData = extracted;
			parseDifficulty(selectedDifficulty);

			// Start lyrics fetch in background (don't block)
			lyricsService
				.fetchLyrics(
					map.metadata.songName,
					map.metadata.songAuthorName,
					null,
					map.metadata.duration
				)
				.finally(() => {
					lyricsReady = true;
				});

			gameCurrentTime = 0;
			sessionState = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			sessionState = 'loading';
		}
	});
</script>

{#if error}
	<div role="alert" class="alert alert-error mb-4">
		<span>{error}</span>
		<button class="btn btn-sm btn-ghost" onclick={() => (error = null)}>
			{$_('common.close')}
		</button>
	</div>
{/if}

{#if sessionState === 'loading'}
	<div class="flex flex-col items-center justify-center gap-4 py-20">
		<span class="loading loading-spinner loading-lg text-primary"></span>
		<p class="text-lg">{loadingProgress}</p>
		{#if selectedMap}
			<p class="text-sm opacity-60">
				{selectedMap.metadata.songName} — {selectedDifficulty}
			</p>
		{/if}
		<Button
			label={$_('common.cancel')}
			color={ThemeColors.Neutral}
			outline
			size={ThemeSizes.Small}
			on:click={handleBackToBrowse}
		/>
	</div>

{:else if sessionState === 'ready' && selectedMap}
	<RhythmDifficultySelect
		map={selectedMap}
		{selectedDifficulty}
		{lyricsReady}
		on:difficultyChange={handleDifficultyChange}
		on:startPlay={handleStartPlay}
		on:back={handleBackToBrowse}
	/>

{:else if sessionState === 'playing' && beatMap}
	<div class="flex gap-4">
		<div class="flex-1 min-w-0">
			<RhythmGame
				{beatMap}
				{audioBase64}
				scrollSpeed={settings.scrollSpeed}
				volume={settings.volume}
				keyBindings={settings.keyBindings}
				offset={settings.offset}
				onfinish={handleGameFinish}
				ontimeupdate={handleTimeUpdate}
			/>
		</div>
		<div class="hidden w-72 lg:block" style="height: 70vh;">
			<RhythmLyricsPanel currentTime={gameCurrentTime} />
		</div>
	</div>

{:else if sessionState === 'results' && finalState}
	<RhythmResults
		gameState={finalState}
		songName={selectedMap?.metadata.songName || ''}
		difficulty={selectedDifficulty}
		saved={scoreSaved}
		onsave={handleSaveScore}
		onplayAgain={handlePlayAgain}
		onbrowse={handleBackToBrowse}
	/>
{/if}
