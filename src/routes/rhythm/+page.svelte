<script lang="ts">
	import { _ } from 'svelte-i18n';
	import classNames from 'classnames';
	import RhythmSongBrowser from '$components/core/RhythmSongBrowser.svelte';
	import RhythmGame from '$components/core/RhythmGame.svelte';
	import RhythmResults from '$components/core/RhythmResults.svelte';
	import RhythmLyricsPanel from '$components/core/RhythmLyricsPanel.svelte';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { beatsaverApi } from '$api/beatsaver';
	import { beatsaverAdapter } from '$adapters/classes/beatsaver.adapter';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { rhythmScoresService } from '$services/rhythm-scores.service';
	import { lyricsService } from '$services/lyrics.service';
	import type {
		BeatSaverMap,
		BeatSaverDiff,
		BeatSaverMapExtracted,
		BeatMap,
		BeatMapInfo,
		RhythmGameState,
		RhythmPageState,
		RhythmScore
	} from '$types/rhythm.type';

	let pageState: RhythmPageState = $state('browsing');
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

	const diffButtonColors: Record<string, string> = {
		Easy: 'btn-success',
		Normal: 'btn-info',
		Hard: 'btn-warning',
		Expert: 'btn-error',
		ExpertPlus: 'btn-secondary'
	};

	function getMapDiffs(map: BeatSaverMap): BeatSaverDiff[] {
		return map.versions?.[0]?.diffs || [];
	}

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

	function handleDifficultyChange(diff: string) {
		selectedDifficulty = diff;
		try {
			parseDifficulty(diff);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function handleStartPlay() {
		gameCurrentTime = 0;
		pageState = 'playing';
	}

	async function handleMapSelect(
		e: CustomEvent<{ map: BeatSaverMap; difficulty: string }>
	) {
		selectedMap = e.detail.map;
		selectedDifficulty = e.detail.difficulty;
		pageState = 'loading';
		error = null;
		scoreSaved = false;
		lyricsReady = false;

		try {
			loadingProgress = $_('rhythm.downloading');
			const version = selectedMap.versions?.[0];
			if (!version) throw new Error('No version available');

			const extracted = await beatsaverApi.downloadMap(version.downloadURL);

			loadingProgress = $_('rhythm.parsing');
			mapInfo = beatsaverAdapter.parseInfoDat(extracted.info_dat);
			extractedData = extracted;
			parseDifficulty(selectedDifficulty);

			// Start lyrics fetch in background (don't block)
			lyricsService
				.fetchLyrics(
					selectedMap.metadata.songName,
					selectedMap.metadata.songAuthorName,
					null,
					selectedMap.metadata.duration
				)
				.finally(() => {
					lyricsReady = true;
				});

			gameCurrentTime = 0;
			pageState = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			pageState = 'browsing';
		}
	}

	function handleGameFinish(detail: { state: RhythmGameState }) {
		finalState = detail.state;
		pageState = 'results';
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
			pageState = 'playing';
		}
	}

	function handleBackToBrowse() {
		pageState = 'browsing';
		beatMap = null;
		audioBase64 = '';
		selectedMap = null;
		extractedData = null;
		finalState = null;
		scoreSaved = false;
		lyricsReady = false;
		gameCurrentTime = 0;
		lyricsService.clear();
	}
</script>

<div class="mx-auto max-w-6xl">
	{#if pageState !== 'playing'}
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">{$_('rhythm.title')}</h1>
				<p class="text-sm opacity-60">{$_('rhythm.subtitle')}</p>
			</div>
		</div>
	{/if}

	{#if error}
		<div role="alert" class="alert alert-error mb-4">
			<span>{error}</span>
			<button class="btn btn-sm btn-ghost" onclick={() => (error = null)}>
				{$_('common.close')}
			</button>
		</div>
	{/if}

	{#if pageState === 'browsing'}
		<RhythmSongBrowser on:select={handleMapSelect} />

	{:else if pageState === 'loading'}
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

	{:else if pageState === 'ready' && selectedMap}
		<div class="flex flex-col items-center gap-6 py-10">
			<div class="flex items-center gap-4">
				{#if selectedMap.versions?.[0]?.coverURL}
					<img
						src={selectedMap.versions[0].coverURL}
						alt={selectedMap.metadata.songName}
						class="h-24 w-24 rounded-lg object-cover shadow-lg"
					/>
				{/if}
				<div>
					<h2 class="text-2xl font-bold">{selectedMap.metadata.songName}</h2>
					<p class="opacity-60">{selectedMap.metadata.songAuthorName}</p>
				</div>
			</div>

			<div class="flex flex-col items-center gap-2">
				<p class="text-sm font-semibold uppercase tracking-wide opacity-60">
					{$_('rhythm.selectDifficulty')}
				</p>
				<div class="flex gap-2">
					{#each getMapDiffs(selectedMap) as diff}
						<button
							class={classNames('btn btn-sm', {
								[diffButtonColors[diff.difficulty] || 'btn-neutral']:
									diff.difficulty === selectedDifficulty,
								'btn-outline btn-ghost': diff.difficulty !== selectedDifficulty
							})}
							onclick={() => handleDifficultyChange(diff.difficulty)}
						>
							{diff.difficulty === 'ExpertPlus' ? 'Expert+' : diff.difficulty}
						</button>
					{/each}
				</div>
			</div>

			<div class="flex flex-col items-center gap-3">
				<Button
					label={$_('rhythm.play')}
					color={ThemeColors.Primary}
					size={ThemeSizes.Large}
					disabled={!lyricsReady}
					on:click={handleStartPlay}
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
				on:click={handleBackToBrowse}
			/>
		</div>

	{:else if pageState === 'playing' && beatMap}
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

	{:else if pageState === 'results' && finalState}
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
</div>
