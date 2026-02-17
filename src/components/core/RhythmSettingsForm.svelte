<script lang="ts">
	import { base } from '$app/paths';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { rhythmSettingsService } from '$services/rhythm-settings.service';
	import { DEFAULT_RHYTHM_SETTINGS } from '$types/rhythm.type';

	let settings = $state(rhythmSettingsService.get());
	let saved = $state(false);

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

<div class="flex flex-col gap-8 max-w-lg">
	<!-- Scroll Speed -->
	<div class="form-control">
		<label class="label" for="scroll-speed">
			<span class="label-text font-semibold">Scroll Speed</span>
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
			<span class="label-text font-semibold">Volume</span>
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
			<span class="label-text font-semibold">Timing Offset (ms)</span>
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

	<!-- Key Bindings (link to controller page) -->
	<div class="form-control">
		<label class="label">
			<span class="label-text font-semibold">Key Bindings</span>
		</label>
		<a href="{base}/rhythm/controller" class="btn btn-outline btn-sm w-fit">
			Configure Bindings
		</a>
	</div>

	<!-- Actions -->
	<div class="flex items-center gap-3">
		<Button
			label="Save"
			color={ThemeColors.Primary}
			size={ThemeSizes.Medium}
			on:click={handleSave}
		/>
		<Button
			label="Reset to Defaults"
			color={ThemeColors.Neutral}
			outline
			size={ThemeSizes.Medium}
			on:click={handleReset}
		/>
		{#if saved}
			<span class="badge badge-success">Settings saved</span>
		{/if}
	</div>
</div>
