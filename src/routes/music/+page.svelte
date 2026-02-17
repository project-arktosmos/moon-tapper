<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { guess } from 'web-audio-beat-detector';
	import RhythmGame from '$components/core/RhythmGame.svelte';
	import RhythmResults from '$components/core/RhythmResults.svelte';
	import { beatGeneratorAdapter } from '$adapters/classes/beatgenerator.adapter';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { condenseTo2Lanes, condenseTo3Lanes } from '$utils/rhythm/condenseLanes';
	import type { BeatMap, RhythmGameState, LaneMode, LaneBinding } from '$types/rhythm.type';
	import { DEFAULT_LANE_MODE, DEFAULT_LANE_MODE_BINDINGS } from '$types/rhythm.type';

	type PageState = 'idle' | 'analyzing' | 'ready' | 'playing' | 'results';

	let pageState: PageState = $state('idle');
	let error: string | null = $state(null);

	// Song data
	let songName = $state('');
	let audioBase64 = $state('');
	let detectedBpm = $state(0);
	let beatOffset = $state(0);
	let songDuration = $state(0);
	let beatMap: BeatMap | null = $state(null);

	// Game settings
	let laneMode: LaneMode = $state(DEFAULT_LANE_MODE);
	let settings = rhythmSettingsService.get();

	// Results
	let finalState: RhythmGameState | null = $state(null);
	let gameCurrentTime = $state(0);

	// File input ref
	let fileInputRef: HTMLInputElement | undefined = $state(undefined);

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

	function arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		error = null;
		songName = file.name.replace(/\.[^/.]+$/, '');
		pageState = 'analyzing';

		try {
			const arrayBuffer = await file.arrayBuffer();

			// Convert to base64 for RhythmGame
			audioBase64 = arrayBufferToBase64(arrayBuffer);

			// Detect BPM
			const tempContext = new AudioContext();
			const audioBuffer = await tempContext.decodeAudioData(arrayBuffer.slice(0));

			songDuration = audioBuffer.duration;

			try {
				const result = await guess(audioBuffer);
				detectedBpm = result.bpm;
				beatOffset = result.offset * 1000;
			} catch {
				detectedBpm = 120;
				beatOffset = 0;
			}

			tempContext.close();

			// Generate beat map
			beatMap = beatGeneratorAdapter.generateBeatMap(songDuration, detectedBpm, beatOffset);

			pageState = 'ready';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			pageState = 'idle';
		}
	}

	function handleStartPlay() {
		gameCurrentTime = 0;
		finalState = null;
		pageState = 'playing';
	}

	function handleGameFinish(detail: { state: RhythmGameState }) {
		finalState = detail.state;
		pageState = 'results';
	}

	function handleTimeUpdate(time: number) {
		gameCurrentTime = time;
	}

	function handlePlayAgain() {
		if (beatMap && audioBase64) {
			gameCurrentTime = 0;
			finalState = null;
			pageState = 'playing';
		}
	}

	function handlePickNewSong() {
		pageState = 'idle';
		songName = '';
		audioBase64 = '';
		beatMap = null;
		detectedBpm = 0;
		beatOffset = 0;
		songDuration = 0;
		finalState = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="mx-auto max-w-6xl">
	{#if pageState !== 'playing'}
		<div class="mb-6">
			<h1 class="text-3xl font-bold">Custom Music</h1>
			<p class="text-sm opacity-60">Load a song from your device and play with auto-generated beats</p>
		</div>
	{/if}

	{#if error}
		<div role="alert" class="alert alert-error mb-4">
			<span>{error}</span>
			<button class="btn btn-sm btn-ghost" onclick={() => (error = null)}>Close</button>
		</div>
	{/if}

	{#if pageState === 'idle'}
		<div class="mx-auto flex max-w-md flex-col items-center gap-6 py-12">
			<div class="card w-full bg-base-100 shadow-xl">
				<div class="card-body items-center text-center">
					<h2 class="card-title text-2xl">Select a Song</h2>
					<p class="text-base-content/70">
						Choose an audio file from your device. BPM will be auto-detected and beats generated.
					</p>

					<input
						bind:this={fileInputRef}
						type="file"
						accept="audio/*"
						class="file-input file-input-bordered file-input-primary mt-4 w-full max-w-xs"
						onchange={handleFileSelect}
					/>

					<p class="mt-2 text-xs text-base-content/40">
						Supports MP3, OGG, WAV, FLAC, and other browser-supported formats
					</p>
				</div>
			</div>
		</div>

	{:else if pageState === 'analyzing'}
		<div class="flex flex-col items-center justify-center gap-4 py-20">
			<span class="loading loading-spinner loading-lg text-primary"></span>
			<p class="text-lg">Analyzing audio...</p>
			<p class="text-sm opacity-60">{songName}</p>
		</div>

	{:else if pageState === 'ready' && beatMap}
		<div class="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
			<div class="card w-full bg-base-100 shadow-xl">
				<div class="card-body items-center text-center">
					<h2 class="card-title text-xl">{songName}</h2>

					<div class="flex flex-wrap justify-center gap-2">
						<div class="badge badge-primary badge-lg">{detectedBpm} BPM</div>
						<div class="badge badge-secondary badge-lg">{formatDuration(songDuration)}</div>
						<div class="badge badge-accent badge-lg">{beatMap.notes.length} notes</div>
					</div>

					<!-- Lane Mode -->
					<div class="form-control mt-4 w-full">
						<div class="label">
							<span class="label-text font-medium">Lane Mode</span>
						</div>
						<div class="flex gap-2">
							{#each [2, 3, 4] as mode}
								<button
									class={classNames('btn flex-1', laneMode === mode ? 'btn-primary' : 'btn-outline')}
									onclick={() => (laneMode = mode as LaneMode)}
								>
									{mode} Lanes
								</button>
							{/each}
						</div>
					</div>

					<div class="card-actions mt-6">
						<button class="btn btn-primary btn-lg" onclick={handleStartPlay}>
							Play
						</button>
						<button class="btn btn-ghost" onclick={handlePickNewSong}>
							Pick Another Song
						</button>
					</div>
				</div>
			</div>
		</div>

	{:else if pageState === 'playing' && gameBeatMap}
		<RhythmGame
			beatMap={gameBeatMap}
			{audioBase64}
			scrollSpeed={settings.scrollSpeed}
			volume={settings.volume}
			keyBindings={gameKeyBindings}
			offset={settings.offset}
			{laneMode}
			onfinish={handleGameFinish}
			ontimeupdate={handleTimeUpdate}
		/>

	{:else if pageState === 'results' && finalState}
		<RhythmResults
			gameState={finalState}
			songName={songName}
			difficulty="Auto-Generated"
			saved={true}
			onplayAgain={handlePlayAgain}
			onbrowse={handlePickNewSong}
		/>
	{/if}
</div>
