<script lang="ts">
	import classNames from 'classnames';
	import { onDestroy } from 'svelte';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { DEFAULT_LANE_MODE_BINDINGS } from '$types/rhythm.type';
	import type { LaneMode, LaneModeBindings, LaneBinding } from '$types/rhythm.type';
	import { getInputLabel } from '$utils/rhythm/getInputLabel';
	import { startGamepadCapture } from '$utils/rhythm/gamepadCapture';

	type CaptureTarget = 'keyboard' | 'gamepad';

	let bindings: LaneModeBindings = $state(
		structuredClone(rhythmSettingsService.get().laneModeBindings)
	);

	let capturingMode: LaneMode | null = $state(null);
	let capturingLane: number | null = $state(null);
	let capturingTarget: CaptureTarget | null = $state(null);
	let stopGamepadCapture: (() => void) | null = null;

	const laneModes: LaneMode[] = [4, 3, 2];

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

	function persist() {
		const settings = rhythmSettingsService.get();
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
	}

	function startCapture(mode: LaneMode, lane: number, target: CaptureTarget) {
		cancelCapture();
		capturingMode = mode;
		capturingLane = lane;
		capturingTarget = target;

		if (target === 'gamepad') {
			stopGamepadCapture = startGamepadCapture((code) => {
				if (capturingMode !== null && capturingLane !== null) {
					setBinding(capturingMode, capturingLane, 'gamepad', code);
					cancelCapture();
				}
			});
		}
	}

	function cancelCapture() {
		capturingMode = null;
		capturingLane = null;
		capturingTarget = null;
		if (stopGamepadCapture) {
			stopGamepadCapture();
			stopGamepadCapture = null;
		}
	}

	function setBinding(mode: LaneMode, lane: number, target: CaptureTarget, code: string) {
		const current = bindings[mode][lane];
		bindings[mode] = {
			...bindings[mode],
			[lane]: { ...current, [target]: code }
		};
		persist();
	}

	function clearGamepad(mode: LaneMode, lane: number) {
		const current = bindings[mode][lane];
		bindings[mode] = {
			...bindings[mode],
			[lane]: { ...current, gamepad: null }
		};
		persist();
	}

	function handleKeyCapture(e: KeyboardEvent) {
		if (capturingMode === null || capturingLane === null || capturingTarget === null) return;
		if (e.code === 'Escape') {
			cancelCapture();
			return;
		}
		if (capturingTarget === 'keyboard') {
			e.preventDefault();
			setBinding(capturingMode, capturingLane, 'keyboard', e.code);
			cancelCapture();
		}
	}

	function handleReset() {
		cancelCapture();
		bindings = structuredClone(DEFAULT_LANE_MODE_BINDINGS);
		persist();
	}

	function isCapturing(mode: LaneMode, lane: number, target: CaptureTarget): boolean {
		return capturingMode === mode && capturingLane === lane && capturingTarget === target;
	}

	onDestroy(() => {
		if (stopGamepadCapture) stopGamepadCapture();
	});
</script>

<svelte:window onkeydown={handleKeyCapture} />

<div class="flex flex-col gap-8 max-w-2xl pb-8">
	<div>
		<h2 class="text-2xl font-bold">Controller Settings</h2>
		<p class="text-sm opacity-60 mt-1">Customize key bindings for keyboard and gamepad</p>
	</div>

	{#each laneModes as mode}
		<div class="card bg-base-200">
			<div class="card-body gap-4">
				<h3 class="card-title text-lg">{mode} Lanes</h3>
				<div class={classNames('grid gap-4', {
					'grid-cols-2': mode === 2,
					'grid-cols-3': mode === 3,
					'grid-cols-4': mode === 4
				})}>
					{#each Array.from({ length: mode }, (_, i) => i) as lane}
						{@const binding = bindings[mode][lane]}
						{@const kbCapturing = isCapturing(mode, lane, 'keyboard')}
						{@const gpCapturing = isCapturing(mode, lane, 'gamepad')}
						<div class={classNames(
							'flex flex-col items-center gap-2 rounded-lg border-2 p-3',
							laneColors[mode][lane],
							laneBgColors[mode][lane]
						)}>
							<span class="text-xs font-semibold opacity-70">
								Lane {lane + 1}
							</span>

							<!-- Keyboard binding -->
							<button
								class={classNames('btn btn-sm w-full font-mono', {
									'btn-outline animate-pulse': kbCapturing,
									'btn-ghost': !kbCapturing
								})}
								onclick={() => kbCapturing ? cancelCapture() : startCapture(mode, lane, 'keyboard')}
							>
								{#if kbCapturing}
									<span class="text-xs">Press a key...</span>
								{:else}
									<span class="text-xs opacity-50">Key</span>
									<span>{getInputLabel(binding.keyboard)}</span>
								{/if}
							</button>

							<!-- Gamepad binding -->
							<div class="flex w-full items-center gap-1">
								<button
									class={classNames('btn btn-sm flex-1 font-mono', {
										'btn-outline animate-pulse': gpCapturing,
										'btn-ghost': !gpCapturing
									})}
									onclick={() => gpCapturing ? cancelCapture() : startCapture(mode, lane, 'gamepad')}
								>
									{#if gpCapturing}
										<span class="text-xs">Press button...</span>
									{:else if binding.gamepad}
										<span class="text-xs opacity-50">Pad</span>
										<span>{getInputLabel(binding.gamepad)}</span>
									{:else}
										<span class="text-xs opacity-40">No gamepad</span>
									{/if}
								</button>
								{#if binding.gamepad && !gpCapturing}
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => clearGamepad(mode, lane)}
									>
										&times;
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				{#if capturingMode === mode}
					<p class="text-xs opacity-50 text-center">Press Esc to cancel</p>
				{/if}
			</div>
		</div>
	{/each}

	<div class="flex items-center gap-3">
		<button class="btn btn-neutral btn-outline btn-sm" onclick={handleReset}>
			Reset to Defaults
		</button>
	</div>
</div>
