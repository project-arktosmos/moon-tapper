<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { DEFAULT_RHYTHM_SETTINGS } from '$types/rhythm.type';

	let settings = $state(rhythmSettingsService.get());
	let capturingLane: number | null = $state(null);
	let saved = $state(false);

	const laneLabels: Record<number, string> = {
		0: '1',
		1: '2',
		2: '3',
		3: '4'
	};

	function getKeyLabel(code: string): string {
		if (code.startsWith('Key')) return code.slice(3);
		if (code.startsWith('Digit')) return code.slice(5);
		return code;
	}

	function handleKeyCapture(e: KeyboardEvent) {
		if (capturingLane === null) return;
		e.preventDefault();
		settings.keyBindings = {
			...settings.keyBindings,
			[capturingLane]: e.code
		};
		capturingLane = null;
	}

	function handleSave() {
		rhythmSettingsService.set(settings);
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}

	function handleReset() {
		settings = { ...DEFAULT_RHYTHM_SETTINGS };
		rhythmSettingsService.set(settings);
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}
</script>

<svelte:window on:keydown={handleKeyCapture} />

<div class="flex flex-col gap-8 max-w-lg">
	<!-- Scroll Speed -->
	<div class="form-control">
		<label class="label" for="scroll-speed">
			<span class="label-text font-semibold">{$_('rhythm.settings.scrollSpeed')}</span>
			<span class="label-text-alt tabular-nums">{settings.scrollSpeed.toFixed(1)}</span>
		</label>
		<input
			id="scroll-speed"
			type="range"
			min="0.5"
			max="2.0"
			step="0.1"
			bind:value={settings.scrollSpeed}
			class="range range-primary"
		/>
		<div class="flex w-full justify-between px-2 text-xs opacity-40">
			<span>0.5</span>
			<span>1.0</span>
			<span>1.5</span>
			<span>2.0</span>
		</div>
	</div>

	<!-- Volume -->
	<div class="form-control">
		<label class="label" for="volume">
			<span class="label-text font-semibold">{$_('rhythm.settings.volume')}</span>
			<span class="label-text-alt tabular-nums">{Math.round(settings.volume * 100)}%</span>
		</label>
		<input
			id="volume"
			type="range"
			min="0"
			max="1"
			step="0.05"
			bind:value={settings.volume}
			class="range range-primary"
		/>
		<div class="flex w-full justify-between px-2 text-xs opacity-40">
			<span>0%</span>
			<span>50%</span>
			<span>100%</span>
		</div>
	</div>

	<!-- Timing Offset -->
	<div class="form-control">
		<label class="label" for="offset">
			<span class="label-text font-semibold">{$_('rhythm.settings.timingOffset')}</span>
			<span class="label-text-alt tabular-nums">{settings.offset}ms</span>
		</label>
		<input
			id="offset"
			type="range"
			min="-100"
			max="100"
			step="5"
			bind:value={settings.offset}
			class="range range-primary"
		/>
		<div class="flex w-full justify-between px-2 text-xs opacity-40">
			<span>-100ms</span>
			<span>0</span>
			<span>+100ms</span>
		</div>
	</div>

	<!-- Key Bindings -->
	<div class="form-control">
		<label class="label">
			<span class="label-text font-semibold">{$_('rhythm.settings.keyBindings')}</span>
		</label>
		<div class="grid grid-cols-4 gap-3">
			{#each [0, 1, 2, 3] as lane}
				<div class="flex flex-col items-center gap-1">
					<span class="text-xs opacity-60">
						{$_('rhythm.settings.lane')} {laneLabels[lane]}
					</span>
					<button
						class="btn btn-outline btn-sm w-full"
						class:btn-primary={capturingLane === lane}
						onclick={() => (capturingLane = capturingLane === lane ? null : lane)}
					>
						{#if capturingLane === lane}
							{$_('rhythm.settings.pressKey')}
						{:else}
							{getKeyLabel(settings.keyBindings[lane])}
						{/if}
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Actions -->
	<div class="flex items-center gap-3">
		<Button
			label={$_('common.save')}
			color={ThemeColors.Primary}
			size={ThemeSizes.Medium}
			on:click={handleSave}
		/>
		<Button
			label={$_('rhythm.settings.resetDefaults')}
			color={ThemeColors.Neutral}
			outline
			size={ThemeSizes.Medium}
			on:click={handleReset}
		/>
		{#if saved}
			<span class="badge badge-success">{$_('rhythm.settings.saved')}</span>
		{/if}
	</div>
</div>
