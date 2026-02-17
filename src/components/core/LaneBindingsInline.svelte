<script lang="ts">
	import classNames from 'classnames';
	import { onDestroy } from 'svelte';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { DEFAULT_LANE_MODE_BINDINGS, DEFAULT_DUEL_LANE_MODE_BINDINGS } from '$types/rhythm.type';
	import type { LaneMode, LaneModeBindings, LaneBinding, DuelLaneModeBindings, GameMode } from '$types/rhythm.type';
	import { getInputLabel } from '$utils/rhythm/getInputLabel';
	import { startGamepadCapture } from '$utils/rhythm/gamepadCapture';

	type CaptureTarget = 'keyboard' | 'gamepad';
	type DuelPlayer = 'player1' | 'player2';

	let { laneMode, gameMode = 'single' }: { laneMode: LaneMode; gameMode?: GameMode } = $props();

	let bindings: LaneModeBindings = $state(
		structuredClone(rhythmSettingsService.get().laneModeBindings)
	);
	let duelBindings: DuelLaneModeBindings = $state(
		structuredClone(rhythmSettingsService.get().duelLaneModeBindings ?? DEFAULT_DUEL_LANE_MODE_BINDINGS)
	);

	let capturingPlayer: DuelPlayer | null = $state(null);
	let capturingLane: number | null = $state(null);
	let capturingTarget: CaptureTarget | null = $state(null);
	let stopGamepadCaptureFn: (() => void) | null = null;

	const laneColors: Record<number, string[]> = {
		4: ['border-error', 'border-success', 'border-info', 'border-warning'],
		3: ['border-error', 'border-info', 'border-warning'],
		2: ['border-error', 'border-warning']
	};

	const laneBgColors: Record<number, string[]> = {
		4: ['bg-error/10', 'bg-success/10', 'bg-info/10', 'bg-warning/10'],
		3: ['bg-error/10', 'bg-info/10', 'bg-warning/10'],
		2: ['bg-error/10', 'bg-warning/10']
	};

	function getBindingsForPlayer(player: DuelPlayer): Record<number, LaneBinding> {
		return duelBindings[player][laneMode];
	}

	function persist() {
		const settings = rhythmSettingsService.get();
		if (gameMode === 'single') {
			const snapshot = $state.snapshot(bindings);
			const kbOnly: Record<number, string> = {};
			for (const [lane, binding] of Object.entries(snapshot[4])) {
				kbOnly[Number(lane)] = (binding as LaneBinding).keyboard;
			}
			rhythmSettingsService.set({
				...settings,
				laneModeBindings: snapshot,
				keyBindings: kbOnly
			});
		} else {
			rhythmSettingsService.set({
				...settings,
				duelLaneModeBindings: $state.snapshot(duelBindings)
			});
		}
	}

	function startCapture(player: DuelPlayer | null, lane: number, target: CaptureTarget) {
		cancelCapture();
		capturingPlayer = player;
		capturingLane = lane;
		capturingTarget = target;

		if (target === 'gamepad') {
			stopGamepadCaptureFn = startGamepadCapture((code) => {
				if (capturingLane !== null) {
					setBinding(capturingPlayer, capturingLane, 'gamepad', code);
					cancelCapture();
				}
			});
		}
	}

	function cancelCapture() {
		capturingPlayer = null;
		capturingLane = null;
		capturingTarget = null;
		if (stopGamepadCaptureFn) {
			stopGamepadCaptureFn();
			stopGamepadCaptureFn = null;
		}
	}

	function setBinding(player: DuelPlayer | null, lane: number, target: CaptureTarget, code: string) {
		if (gameMode === 'single' || player === null) {
			const current = bindings[laneMode][lane];
			bindings[laneMode] = {
				...bindings[laneMode],
				[lane]: { ...current, [target]: code }
			};
		} else {
			const current = duelBindings[player][laneMode][lane];
			duelBindings[player] = {
				...duelBindings[player],
				[laneMode]: {
					...duelBindings[player][laneMode],
					[lane]: { ...current, [target]: code }
				}
			};
		}
		persist();
	}

	function clearGamepad(player: DuelPlayer | null, lane: number) {
		if (gameMode === 'single' || player === null) {
			const current = bindings[laneMode][lane];
			bindings[laneMode] = {
				...bindings[laneMode],
				[lane]: { ...current, gamepad: null }
			};
		} else {
			const current = duelBindings[player][laneMode][lane];
			duelBindings[player] = {
				...duelBindings[player],
				[laneMode]: {
					...duelBindings[player][laneMode],
					[lane]: { ...current, gamepad: null }
				}
			};
		}
		persist();
	}

	function handleKeyCapture(e: KeyboardEvent) {
		if (capturingLane === null || capturingTarget === null) return;
		if (e.code === 'Escape') {
			cancelCapture();
			return;
		}
		if (capturingTarget === 'keyboard') {
			e.preventDefault();
			setBinding(capturingPlayer, capturingLane, 'keyboard', e.code);
			cancelCapture();
		}
	}

	function handleReset() {
		cancelCapture();
		if (gameMode === 'single') {
			bindings[laneMode] = structuredClone(DEFAULT_LANE_MODE_BINDINGS[laneMode]);
		} else {
			duelBindings.player1[laneMode] = structuredClone(DEFAULT_DUEL_LANE_MODE_BINDINGS.player1[laneMode]);
			duelBindings.player2[laneMode] = structuredClone(DEFAULT_DUEL_LANE_MODE_BINDINGS.player2[laneMode]);
		}
		persist();
	}

	function isCapturing(player: DuelPlayer | null, lane: number, target: CaptureTarget): boolean {
		return capturingPlayer === player && capturingLane === lane && capturingTarget === target;
	}

	onDestroy(() => {
		if (stopGamepadCaptureFn) stopGamepadCaptureFn();
	});
</script>

<svelte:window onkeydown={handleKeyCapture} />

{#snippet laneGrid(player: DuelPlayer | null, laneBindings: Record<number, LaneBinding>)}
	<div class={classNames('grid gap-3', {
		'grid-cols-2': laneMode === 2,
		'grid-cols-3': laneMode === 3,
		'grid-cols-4': laneMode === 4
	})}>
		{#each Array.from({ length: laneMode }, (_, i) => i) as lane}
			{@const binding = laneBindings[lane]}
			{@const kbCapturing = isCapturing(player, lane, 'keyboard')}
			{@const gpCapturing = isCapturing(player, lane, 'gamepad')}
			<div class={classNames(
				'flex flex-col items-center gap-1.5 rounded-lg border-2 p-2',
				laneColors[laneMode][lane],
				laneBgColors[laneMode][lane]
			)}>
				<span class="text-xs font-semibold opacity-70">
					Lane {lane + 1}
				</span>

				<button
					class={classNames('btn btn-xs w-full font-mono', {
						'btn-outline animate-pulse': kbCapturing,
						'btn-ghost': !kbCapturing
					})}
					onclick={() => kbCapturing ? cancelCapture() : startCapture(player, lane, 'keyboard')}
				>
					{#if kbCapturing}
						<span class="text-xs">Press key...</span>
					{:else}
						<span class="text-xs opacity-50">Key</span>
						<span>{getInputLabel(binding.keyboard)}</span>
					{/if}
				</button>

				<div class="flex w-full items-center gap-0.5">
					<button
						class={classNames('btn btn-xs flex-1 font-mono', {
							'btn-outline animate-pulse': gpCapturing,
							'btn-ghost': !gpCapturing
						})}
						onclick={() => gpCapturing ? cancelCapture() : startCapture(player, lane, 'gamepad')}
					>
						{#if gpCapturing}
							<span class="text-xs">Press btn...</span>
						{:else if binding.gamepad}
							<span class="text-xs opacity-50">Pad</span>
							<span>{getInputLabel(binding.gamepad)}</span>
						{:else}
							<span class="text-xs opacity-40">No pad</span>
						{/if}
					</button>
					{#if binding.gamepad && !gpCapturing}
						<button
							class="btn btn-ghost btn-xs px-1"
							onclick={() => clearGamepad(player, lane)}
						>
							&times;
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col items-center gap-3">
	<p class="text-sm font-semibold uppercase tracking-wide opacity-60">
		Bindings
	</p>

	{#if gameMode === 'single'}
		{@render laneGrid(null, bindings[laneMode])}
	{:else}
		<div class="flex flex-col gap-4 w-full">
			<div class="flex flex-col items-center gap-2">
				<span class="badge badge-sm badge-neutral">Player 1</span>
				{@render laneGrid('player1', getBindingsForPlayer('player1'))}
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="badge badge-sm badge-neutral">Player 2</span>
				{@render laneGrid('player2', getBindingsForPlayer('player2'))}
			</div>
		</div>
	{/if}

	{#if capturingLane !== null}
		<p class="text-xs opacity-50">Press Esc to cancel</p>
	{/if}

	<button class="btn btn-ghost btn-xs opacity-50" onclick={handleReset}>
		Reset bindings
	</button>
</div>
