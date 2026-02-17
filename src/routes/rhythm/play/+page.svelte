<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import RhythmGame from '$components/core/RhythmGame.svelte';
	import RhythmResults from '$components/core/RhythmResults.svelte';
	import RhythmDuelResults from '$components/core/RhythmDuelResults.svelte';
	import RhythmDifficultySelect from '$components/core/RhythmDifficultySelect.svelte';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { beatsaverApi } from '$api/beatsaver';
	import { beatsaverAdapter } from '$adapters/classes/beatsaver.adapter';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { rhythmScoresService } from '$services/rhythm-scores.service';
	import { determineDuelWinner } from '$utils/rhythm/determineDuelWinner';
	import type {
		BeatSaverMap,
		BeatSaverMapExtracted,
		BeatMap,
		BeatMapInfo,
		RhythmGameState,
		GameSessionState,
		RhythmScore,
		LaneMode,
		LaneBinding,
		GameMode
	} from '$types/rhythm.type';
	import { DEFAULT_LANE_MODE, DEFAULT_LANE_MODE_BINDINGS, DEFAULT_DUEL_LANE_MODE_BINDINGS, DEFAULT_GAME_MODE } from '$types/rhythm.type';
	import { condenseTo2Lanes, condenseTo3Lanes } from '$utils/rhythm/condenseLanes';

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

	// Results (single mode)
	let finalState: RhythmGameState | null = $state(null);
	let scoreSaved = $state(false);

	// Extracted data for difficulty switching
	let extractedData: BeatSaverMapExtracted | null = $state(null);

	// Lane mode (per-session, not persisted)
	let laneMode: LaneMode = $state(DEFAULT_LANE_MODE);

	// Game mode
	let gameMode: GameMode = $state(DEFAULT_GAME_MODE);

	// Duel state
	let player1State: RhythmGameState | null = $state(null);
	let player2State: RhythmGameState | null = $state(null);
	let duelFinishedCount = $state(0);

	// Derived game data based on lane mode
	let gameBeatMap: BeatMap | null = $derived.by(() => {
		if (!beatMap) return null;
		if (laneMode === 2) return condenseTo2Lanes(beatMap);
		if (laneMode === 3) return condenseTo3Lanes(beatMap);
		return beatMap;
	});

	let gameKeyBindings: Record<number, LaneBinding> = $derived.by(() => {
		return settings.laneModeBindings?.[laneMode] ?? DEFAULT_LANE_MODE_BINDINGS[laneMode];
	});

	let duelKeyBindingsP1: Record<number, LaneBinding> = $derived.by(() => {
		const duel = settings.duelLaneModeBindings ?? DEFAULT_DUEL_LANE_MODE_BINDINGS;
		return duel.player1[laneMode] ?? DEFAULT_DUEL_LANE_MODE_BINDINGS.player1[laneMode];
	});

	let duelKeyBindingsP2: Record<number, LaneBinding> = $derived.by(() => {
		const duel = settings.duelLaneModeBindings ?? DEFAULT_DUEL_LANE_MODE_BINDINGS;
		return duel.player2[laneMode] ?? DEFAULT_DUEL_LANE_MODE_BINDINGS.player2[laneMode];
	});

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

	function handleLaneModeChange(e: CustomEvent<{ laneMode: LaneMode }>) {
		laneMode = e.detail.laneMode;
	}

	function handleGameModeChange(e: CustomEvent<{ gameMode: GameMode }>) {
		gameMode = e.detail.gameMode;
	}

	function handleStartPlay() {
		sessionState = 'playing';
	}

	function handleGameFinish(detail: { state: RhythmGameState }) {
		finalState = detail.state;
		sessionState = 'results';
	}

	function handlePlayer1Finish(detail: { state: RhythmGameState }) {
		player1State = detail.state;
		duelFinishedCount++;
		checkDuelComplete();
	}

	function handlePlayer2Finish(detail: { state: RhythmGameState }) {
		player2State = detail.state;
		duelFinishedCount++;
		checkDuelComplete();
	}

	function checkDuelComplete() {
		if (duelFinishedCount >= 2) {
			sessionState = 'results';
		}
	}

	function handleDuelEscape(e: KeyboardEvent) {
		if (e.code === 'Escape' && sessionState === 'playing' && gameMode === 'duel') {
			sessionState = 'results';
			if (!player1State) {
				player1State = { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, health: 0 };
				duelFinishedCount++;
			}
			if (!player2State) {
				player2State = { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, health: 0 };
				duelFinishedCount++;
			}
		}
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
			player1State = null;
			player2State = null;
			duelFinishedCount = 0;
			sessionState = 'playing';
		}
	}

	function handleBackToBrowse() {
		goto(`${base}/rhythm`);
	}

	onMount(async () => {
		const mapId = $page.url.searchParams.get('mapId');
		const difficulty = $page.url.searchParams.get('difficulty') || 'Normal';

		if (!mapId) {
			goto(`${base}/rhythm`);
			return;
		}

		selectedDifficulty = difficulty;

		try {
			loadingProgress = 'Downloading map...';
			const map = await beatsaverApi.getMapById(mapId);
			selectedMap = map;

			const version = map.versions?.[0];
			if (!version) throw new Error('No version available');

			const extracted = await beatsaverApi.downloadTrack(map.id, version.downloadURL);

			loadingProgress = 'Loading beatmap...';
			mapInfo = beatsaverAdapter.parseInfoDat(extracted.info_dat);
			extractedData = extracted;
			parseDifficulty(selectedDifficulty);

			sessionState = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			sessionState = 'loading';
		}

		window.addEventListener('keydown', handleDuelEscape);
		return () => {
			window.removeEventListener('keydown', handleDuelEscape);
		};
	});
</script>

{#if error}
	<div role="alert" class="alert alert-error mb-4">
		<span>{error}</span>
		<button class="btn btn-sm btn-ghost" onclick={() => (error = null)}>
			Close
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
			label="Cancel"
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
		{laneMode}
		{gameMode}
		on:difficultyChange={handleDifficultyChange}
		on:laneModeChange={handleLaneModeChange}
		on:gameModeChange={handleGameModeChange}
		on:startPlay={handleStartPlay}
		on:back={handleBackToBrowse}
	/>

{:else if sessionState === 'playing' && gameBeatMap && gameMode === 'single'}
	<RhythmGame
		beatMap={gameBeatMap}
		{audioBase64}
		scrollSpeed={settings.scrollSpeed}
		volume={settings.volume}
		keyBindings={gameKeyBindings}
		offset={settings.offset}
		{laneMode}
		onfinish={handleGameFinish}
	/>

{:else if sessionState === 'playing' && gameBeatMap && gameMode === 'duel'}
	<div class="fixed inset-0 z-50 flex flex-col bg-base-100">
		<!-- Player 2 (top, rotated 180deg for face-to-face mobile play) -->
		<div class="relative flex-1 rotate-180 overflow-hidden">
			<RhythmGame
				beatMap={gameBeatMap}
				{audioBase64}
				scrollSpeed={settings.scrollSpeed}
				volume={0}
				keyBindings={duelKeyBindingsP2}
				offset={settings.offset}
				{laneMode}
				compact
				onfinish={handlePlayer2Finish}
			/>
		</div>

		<!-- VS divider -->
		<div class="flex h-8 shrink-0 items-center justify-center bg-base-300">
			<span class="text-xs font-bold uppercase tracking-widest opacity-60">VS</span>
		</div>

		<!-- Player 1 (bottom, normal orientation) -->
		<div class="relative flex-1 overflow-hidden">
			<RhythmGame
				beatMap={gameBeatMap}
				{audioBase64}
				scrollSpeed={settings.scrollSpeed}
				volume={settings.volume}
				keyBindings={duelKeyBindingsP1}
				offset={settings.offset}
				{laneMode}
				compact
				onfinish={handlePlayer1Finish}
			/>
		</div>
	</div>

{:else if sessionState === 'results' && gameMode === 'duel' && player1State && player2State}
	<RhythmDuelResults
		{player1State}
		{player2State}
		winner={determineDuelWinner(player1State, player2State)}
		songName={selectedMap?.metadata.songName || ''}
		difficulty={selectedDifficulty}
		onplayAgain={handlePlayAgain}
		onbrowse={handleBackToBrowse}
	/>

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
