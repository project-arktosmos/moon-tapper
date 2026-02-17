<script lang="ts">
	import classNames from 'classnames';
	import { lyricsService } from '$services/lyrics.service';
	import type { LyricsState } from '$types/lyrics.type';
	import { tick } from 'svelte';

	interface Props {
		currentTime: number;
	}

	let { currentTime }: Props = $props();

	const lyricsState = lyricsService.store;

	let lyricsContainer: HTMLDivElement | undefined = $state(undefined);
	let lastScrolledIndex = -1;

	let lyrics: LyricsState = $state({ status: 'idle', lyrics: null, error: null });

	lyricsState.subscribe((value) => {
		lyrics = value;
	});

	let currentLineIndex: number = $derived.by(() => {
		if (!lyrics.lyrics?.syncedLyrics) return -1;
		return lyricsService.getCurrentLineIndex(currentTime);
	});

	$effect(() => {
		if (currentLineIndex >= 0 && currentLineIndex !== lastScrolledIndex && lyricsContainer) {
			lastScrolledIndex = currentLineIndex;
			scrollToLine(currentLineIndex);
		}
	});

	async function scrollToLine(index: number) {
		await tick();
		if (!lyricsContainer) return;
		const el = lyricsContainer.querySelector(`[data-line-index="${index}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden rounded-lg border-2 border-base-300 bg-base-200/80">
	<div class="flex items-center justify-between border-b border-base-300 px-3 py-2">
		<h4 class="text-sm font-semibold text-base-content/70">Lyrics</h4>
		{#if lyrics.status === 'success' && lyrics.lyrics?.syncedLyrics}
			<span class="badge badge-xs badge-primary">Synced</span>
		{/if}
	</div>

	<div
		bind:this={lyricsContainer}
		class="flex-1 overflow-y-auto scroll-smooth px-3 py-2"
	>
		{#if lyrics.status === 'loading'}
			<div class="flex h-full flex-col items-center justify-center">
				<span class="loading loading-spinner loading-md text-primary"></span>
				<span class="mt-2 text-sm text-base-content/60">Fetching lyrics...</span>
			</div>
		{:else if lyrics.status === 'not_found'}
			<div class="flex h-full flex-col items-center justify-center text-base-content/40">
				<span class="text-sm">No lyrics found</span>
			</div>
		{:else if lyrics.status === 'error'}
			<div class="flex h-full flex-col items-center justify-center text-error/60">
				<span class="text-sm">Failed to load lyrics</span>
				<span class="mt-1 text-xs">{lyrics.error}</span>
			</div>
		{:else if lyrics.status === 'success' && lyrics.lyrics}
			{#if lyrics.lyrics.instrumental}
				<div class="flex h-full flex-col items-center justify-center text-base-content/40">
					<span class="text-sm">Instrumental</span>
				</div>
			{:else if lyrics.lyrics.syncedLyrics && lyrics.lyrics.syncedLyrics.length > 0}
				<div class="space-y-1 py-4">
					{#each lyrics.lyrics.syncedLyrics as line, index}
						<div
							data-line-index={index}
							class={classNames(
								'rounded px-2 py-1 text-sm transition-all duration-200',
								{
									'bg-primary text-primary-content font-semibold': index === currentLineIndex,
									'text-base-content/50': index !== currentLineIndex
								}
							)}
						>
							{#if line.text}
								{line.text}
							{:else}
								<span class="text-base-content/20">...</span>
							{/if}
						</div>
					{/each}
				</div>
			{:else if lyrics.lyrics.plainLyrics}
				<div class="whitespace-pre-wrap py-4 text-sm leading-relaxed text-base-content/70">
					{lyrics.lyrics.plainLyrics}
				</div>
			{:else}
				<div class="flex h-full flex-col items-center justify-center text-base-content/40">
					<span class="text-sm">No lyrics found</span>
				</div>
			{/if}
		{:else}
			<div class="flex h-full flex-col items-center justify-center text-base-content/30">
				<span class="text-sm">Lyrics will appear here</span>
			</div>
		{/if}
	</div>
</div>
