<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import type { BeatMap, GameNote, RhythmGameState } from '$types/rhythm.type';
	import { DEFAULT_RHYTHM_GAME_STATE } from '$types/rhythm.type';

	interface Props {
		beatMap: BeatMap;
		audioBase64: string;
		scrollSpeed?: number;
		volume?: number;
		keyBindings?: Record<number, string>;
		offset?: number;
		onfinish?: (detail: { state: RhythmGameState }) => void;
		ontimeupdate?: (time: number) => void;
	}

	let {
		beatMap,
		audioBase64,
		scrollSpeed = 1.0,
		volume = 0.8,
		keyBindings = { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' },
		offset = 0,
		onfinish,
		ontimeupdate
	}: Props = $props();

	// Game constants
	const PERFECT_WINDOW = 0.05;
	const GOOD_WINDOW = 0.1;
	const MISS_WINDOW = 0.15;
	const PERFECT_SCORE = 100;
	const GOOD_SCORE = 50;
	const HEALTH_DRAIN = 5;
	const PIXELS_PER_SECOND = 400;
	const COUNTDOWN_SECONDS = 3;

	// Lane configuration
	const LANE_COLORS = ['bg-error', 'bg-success', 'bg-info', 'bg-warning'];
	const LANE_KEYS = ['D', 'F', 'J', 'K'];
	const ROW_SIZES: Record<number, string> = { 0: 'h-8 w-12', 1: 'h-7 w-11', 2: 'h-6 w-10' };
	const ROW_OPACITY: Record<number, string> = { 0: 'opacity-100', 1: 'opacity-80', 2: 'opacity-60' };

	// Build reverse key map (code → column index)
	let reverseKeyMap: Record<string, number> = $derived.by(() => {
		const map: Record<string, number> = {};
		for (const [col, code] of Object.entries(keyBindings)) {
			map[code] = Number(col);
		}
		return map;
	});

	// Game state
	let gameState: RhythmGameState = $state({ ...DEFAULT_RHYTHM_GAME_STATE });
	let gameNotes: GameNote[] = $state([]);
	let phase: 'countdown' | 'playing' | 'done' = $state('countdown');
	let countdownValue = $state(COUNTDOWN_SECONDS);

	// Audio
	let audioCtx: AudioContext | null = null;
	let sourceNode: AudioBufferSourceNode | null = null;
	let gainNode: GainNode | null = null;
	let audioStartTime = 0;

	// Rendering
	let gameAreaRef: HTMLDivElement | undefined = $state(undefined);
	let gameAreaHeight = $state(600);
	let animFrameId: number | null = null;
	let currentTime = $state(0);

	// Input state
	let pressedLanes: boolean[] = $state([false, false, false, false]);
	let laneFlash: number[] = $state([0, 0, 0, 0]);
	let hitFeedback: { text: string; column: number; time: number }[] = $state([]);

	// Computed: visible notes window
	let visibleNotes: GameNote[] = $derived.by(() => {
		const lookAhead = (gameAreaHeight / PIXELS_PER_SECOND) / scrollSpeed + 0.5;
		return gameNotes.filter(
			(n) => !n.hit && !n.missed && n.time >= currentTime - 0.3 && n.time <= currentTime + lookAhead
		);
	});

	function getAudioTime(): number {
		if (!audioCtx || phase !== 'playing') return 0;
		return audioCtx.currentTime - audioStartTime + offset / 1000;
	}

	async function initAudio() {
		audioCtx = new AudioContext();
		gainNode = audioCtx.createGain();
		gainNode.gain.value = volume;
		gainNode.connect(audioCtx.destination);

		const binaryString = atob(audioBase64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
		sourceNode = audioCtx.createBufferSource();
		sourceNode.buffer = audioBuffer;
		sourceNode.connect(gainNode);
		sourceNode.onended = handleSongEnd;
		return audioBuffer.duration;
	}

	function startAudio() {
		if (!audioCtx || !sourceNode) return;
		audioStartTime = audioCtx.currentTime;
		sourceNode.start(0);
	}

	function handleSongEnd() {
		if (phase === 'done') return;
		phase = 'done';
		for (const note of gameNotes) {
			if (!note.hit && !note.missed) {
				note.missed = true;
				gameState.miss++;
			}
		}
		gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
		if (animFrameId !== null) cancelAnimationFrame(animFrameId);
		onfinish?.({ state: { ...gameState } });
	}

	function gameLoop() {
		if (phase !== 'playing') return;
		currentTime = getAudioTime();
		ontimeupdate?.(currentTime);
		checkMissedNotes();
		updateFlashes();
		animFrameId = requestAnimationFrame(gameLoop);
	}

	function checkMissedNotes() {
		for (const note of gameNotes) {
			if (note.hit || note.missed) continue;
			if (note.type === 'bomb') continue;
			if (currentTime - note.time > MISS_WINDOW) {
				note.missed = true;
				gameState.miss++;
				gameState.combo = 0;
				gameState.health = Math.max(0, gameState.health - HEALTH_DRAIN);
				addFeedback('MISS', note.column);
				if (gameState.health <= 0) handleSongEnd();
			}
		}
	}

	function updateFlashes() {
		laneFlash = laneFlash.map((v) => Math.max(0, v - 0.05));
	}

	function addFeedback(text: string, column: number) {
		const fb = { text, column, time: Date.now() };
		hitFeedback = [...hitFeedback.filter((f) => Date.now() - f.time < 600), fb];
	}

	function handleHit(column: number) {
		if (phase !== 'playing') return;
		pressedLanes[column] = true;
		laneFlash[column] = 1;

		const time = getAudioTime();

		let best: GameNote | null = null;
		let bestDelta = Infinity;
		for (const note of gameNotes) {
			if (note.hit || note.missed || note.column !== column) continue;
			const delta = Math.abs(note.time - time);
			if (delta < bestDelta && delta <= MISS_WINDOW) {
				best = note;
				bestDelta = delta;
			}
		}

		if (!best) return;

		if (best.type === 'bomb') {
			best.hit = true;
			gameState.combo = 0;
			gameState.health = Math.max(0, gameState.health - HEALTH_DRAIN * 2);
			addFeedback('BOMB', column);
			if (gameState.health <= 0) handleSongEnd();
			return;
		}

		best.hit = true;
		const comboMultiplier = 1 + Math.floor(gameState.combo / 10) * 0.1;

		if (bestDelta <= PERFECT_WINDOW) {
			best.score = Math.round(PERFECT_SCORE * comboMultiplier);
			gameState.perfect++;
			addFeedback('PERFECT', column);
		} else if (bestDelta <= GOOD_WINDOW) {
			best.score = Math.round(GOOD_SCORE * comboMultiplier);
			gameState.good++;
			addFeedback('GOOD', column);
		} else {
			best.score = Math.round(GOOD_SCORE * 0.5 * comboMultiplier);
			gameState.good++;
			addFeedback('OK', column);
		}

		gameState.score += best.score;
		gameState.combo++;
		gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
	}

	function handleRelease(column: number) {
		pressedLanes[column] = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.repeat) return;
		const col = reverseKeyMap[e.code];
		if (col !== undefined) {
			e.preventDefault();
			handleHit(col);
		}
		if (e.code === 'Escape') handleSongEnd();
	}

	function handleKeyUp(e: KeyboardEvent) {
		const col = reverseKeyMap[e.code];
		if (col !== undefined) handleRelease(col);
	}

	function getNoteY(noteTime: number): number {
		const delta = noteTime - currentTime;
		const hitZoneY = gameAreaHeight - 80;
		return hitZoneY - delta * PIXELS_PER_SECOND * scrollSpeed;
	}

	async function startGame() {
		gameNotes = beatMap.notes.map((n, i) => ({
			...n,
			id: i,
			hit: false,
			missed: false,
			score: 0
		}));
		gameState = { ...DEFAULT_RHYTHM_GAME_STATE };

		await initAudio();

		phase = 'countdown';
		countdownValue = COUNTDOWN_SECONDS;
		const countdownInterval = setInterval(() => {
			countdownValue--;
			if (countdownValue <= 0) {
				clearInterval(countdownInterval);
				phase = 'playing';
				startAudio();
				animFrameId = requestAnimationFrame(gameLoop);
			}
		}, 1000);
	}

	function cleanup() {
		if (animFrameId !== null) cancelAnimationFrame(animFrameId);
		if (sourceNode) {
			try { sourceNode.stop(); } catch {}
		}
		if (audioCtx) audioCtx.close();
	}

	onMount(() => {
		if (gameAreaRef) {
			gameAreaHeight = gameAreaRef.clientHeight;
		}
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		startGame();

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			cleanup();
		};
	});

	$effect(() => {
		if (gainNode) gainNode.gain.value = volume;
	});
</script>

<div class="relative flex flex-col items-center gap-2">
	<!-- HUD -->
	<div class="flex w-full max-w-lg items-center justify-between px-2">
		<div class="flex items-center gap-4">
			<span class="text-2xl font-bold tabular-nums">{gameState.score}</span>
			<span class={classNames('text-lg font-semibold tabular-nums', {
				'text-warning': gameState.combo >= 10,
				'text-error': gameState.combo >= 50
			})}>
				{gameState.combo}x
			</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-sm opacity-60">HP</span>
			<progress
				class={classNames('progress w-32', {
					'progress-success': gameState.health > 60,
					'progress-warning': gameState.health > 30 && gameState.health <= 60,
					'progress-error': gameState.health <= 30
				})}
				value={gameState.health}
				max="100"
			></progress>
		</div>
	</div>

	<!-- Game area -->
	<div
		bind:this={gameAreaRef}
		class="relative w-full max-w-lg overflow-hidden rounded-lg border-2 border-base-300 bg-base-300/50"
		style="height: 70vh;"
	>
		<!-- Lane backgrounds -->
		<div class="absolute inset-0 flex">
			{#each [0, 1, 2, 3] as col}
				<div
					class={classNames('flex-1 border-r border-base-content/10', {
						'bg-base-content/5': col % 2 === 0
					})}
				></div>
			{/each}
		</div>

		<!-- Lane flash overlays -->
		{#each [0, 1, 2, 3] as col}
			{#if laneFlash[col] > 0}
				<div
					class={classNames('pointer-events-none absolute top-0 bottom-0', LANE_COLORS[col])}
					style="left: {col * 25}%; width: 25%; opacity: {laneFlash[col] * 0.2};"
				></div>
			{/if}
		{/each}

		<!-- Notes -->
		{#each visibleNotes as note (note.id)}
			{@const y = getNoteY(note.time)}
			{@const sizeClass = ROW_SIZES[note.row] || 'h-8 w-12'}
			{@const opacityClass = ROW_OPACITY[note.row] || 'opacity-100'}
			{@const isBomb = note.type === 'bomb'}
			{#if y > -50 && y < gameAreaHeight + 50}
				<div
					class="absolute flex items-center justify-center"
					style="left: {note.column * 25}%; width: 25%; top: {y}px; transform: translateY(-50%);"
				>
					<div
						class={classNames(
							'rounded-md shadow-lg flex items-center justify-center text-xs font-bold',
							sizeClass,
							opacityClass,
							{
								[LANE_COLORS[note.column]]: !isBomb,
								'bg-neutral text-neutral-content': isBomb,
								'text-error-content': note.type === 'left',
								'text-success-content': note.type === 'right',
							}
						)}
					>
						{#if isBomb}
							X
						{:else if note.row === 2}
							^
						{:else if note.row === 0}
							v
						{/if}
					</div>
				</div>
			{/if}
		{/each}

		<!-- Hit feedback -->
		{#each hitFeedback as fb}
			{@const age = Date.now() - fb.time}
			{#if age < 600}
				<div
					class={classNames(
						'pointer-events-none absolute text-center text-sm font-bold',
						{
							'text-warning': fb.text === 'PERFECT',
							'text-success': fb.text === 'GOOD' || fb.text === 'OK',
							'text-error': fb.text === 'MISS' || fb.text === 'BOMB'
						}
					)}
					style="left: {fb.column * 25}%; width: 25%; bottom: 100px; opacity: {1 - age / 600}; transform: translateY({-age * 0.05}px);"
				>
					{fb.text}
				</div>
			{/if}
		{/each}

		<!-- Hit zone line -->
		<div
			class="absolute left-0 right-0 h-0.5 bg-primary/60"
			style="bottom: 80px;"
		></div>

		<!-- Hit zone targets -->
		<div class="absolute bottom-4 left-0 right-0 flex">
			{#each [0, 1, 2, 3] as col}
				<div class="flex flex-1 items-center justify-center">
					<div
						class={classNames(
							'flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-bold transition-transform',
							{
								[`${LANE_COLORS[col]} scale-110 border-transparent`]: pressedLanes[col],
								'border-base-content/30 bg-base-100/50': !pressedLanes[col]
							}
						)}
					>
						{LANE_KEYS[col]}
					</div>
				</div>
			{/each}
		</div>

		<!-- Countdown overlay -->
		{#if phase === 'countdown'}
			<div class="absolute inset-0 flex items-center justify-center bg-base-100/80">
				<span class="text-8xl font-bold text-primary">{countdownValue}</span>
			</div>
		{/if}
	</div>

	<!-- Key hints -->
	<div class="flex w-full max-w-lg justify-center gap-4 text-sm opacity-40">
		<span><kbd class="kbd kbd-sm">D</kbd><kbd class="kbd kbd-sm">F</kbd><kbd class="kbd kbd-sm">J</kbd><kbd class="kbd kbd-sm">K</kbd> to hit</span>
		<span><kbd class="kbd kbd-sm">Esc</kbd> to quit</span>
	</div>
</div>
