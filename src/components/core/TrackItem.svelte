<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher, onMount } from 'svelte';
	import { isTauri } from '$utils/isTauri';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	interface Props {
		id?: string;
		coverURL?: string;
		songName: string;
		songAuthorName: string;
		levelAuthorName?: string;
		bpm: number;
		duration: number;
		diffs?: { difficulty: string }[];
		selectedDifficulty?: string;
	}

	let {
		id = '',
		coverURL = '',
		songName,
		songAuthorName,
		levelAuthorName = '',
		bpm,
		duration,
		diffs = [],
		selectedDifficulty = ''
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		diffSelect: { difficulty: string };
		play: void;
	}>();

	const tauriAvailable = isTauri();

	// Status state
	let trackDownloaded: boolean | null = $state(null);
	let fetchingTrack = $state(false);

	const diffColors: Record<string, string> = {
		Easy: 'badge-success',
		Normal: 'badge-info',
		Hard: 'badge-warning',
		Expert: 'badge-error',
		ExpertPlus: 'badge-secondary'
	};

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	onMount(() => {
		if (tauriAvailable && id) {
			checkStatus();
		}
	});

	async function checkStatus() {
		try {
			const { beatsaverApi } = await import('$api/beatsaver');
			trackDownloaded = await beatsaverApi.hasDownloadedMap(id);
		} catch {
			trackDownloaded = null;
		}
	}

	async function handleFetchTrack() {
		if (!id || fetchingTrack) return;
		fetchingTrack = true;
		try {
			const { beatsaverApi } = await import('$api/beatsaver');
			const { listen } = await import('@tauri-apps/api/event');
			const map = await beatsaverApi.getMapById(id);
			const version = map.versions?.[0];
			if (!version) {
				fetchingTrack = false;
				return;
			}
			const mapId = await beatsaverApi.fetchTrack(map.id, version.downloadURL);
			const unlisten = await listen<{ mapId: string }>('beatsaver:track-ready', (event) => {
				if (event.payload.mapId === mapId) {
					trackDownloaded = true;
					fetchingTrack = false;
					unlisten();
				}
			});
		} catch {
			fetchingTrack = false;
		}
	}

</script>

<div class="card bg-base-200 shadow-md">
	{#if coverURL}
		<figure class="aspect-square">
			<img
				src={coverURL}
				alt={songName}
				class="h-full w-full object-cover"
			/>
		</figure>
	{/if}
	<div class="card-body gap-1 p-4">
		<h3 class="card-title text-base line-clamp-1">{songName}</h3>
		<p class="text-sm opacity-60 line-clamp-1">
			{songAuthorName}
			{#if levelAuthorName}
				<span class="opacity-40">/ mapped by {levelAuthorName}</span>
			{/if}
		</p>
		<div class="flex flex-wrap items-center gap-1">
			<span class="badge badge-ghost badge-sm">{Math.round(bpm)} BPM</span>
			<span class="badge badge-ghost badge-sm">{formatDuration(duration)}</span>
			{#if tauriAvailable && id}
				{#if trackDownloaded}
					<span class="badge badge-success badge-sm gap-1" title="Song data cached locally">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM6.7 11.3l5-5a.7.7 0 0 0-1-1L6.2 9.8 5.3 8.9a.7.7 0 1 0-1 1l1.4 1.4a.7.7 0 0 0 1 0Z"/></svg>
						Downloaded
					</span>
				{:else if trackDownloaded === false}
					{#if fetchingTrack}
						<span class="badge badge-ghost badge-sm gap-1">
							<span class="loading loading-spinner loading-xs"></span>
						</span>
					{:else}
						<button
							class="badge badge-primary badge-sm gap-1 cursor-pointer badge-outline"
							title="Download track data"
							on:click|stopPropagation={handleFetchTrack}
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M8 1a.75.75 0 0 1 .75.75v6.69l2.22-2.22a.75.75 0 0 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V1.75A.75.75 0 0 1 8 1ZM2.75 11a.75.75 0 0 1 .75.75v1.5h9v-1.5a.75.75 0 0 1 1.5 0v1.5A1.5 1.5 0 0 1 12.5 14.75h-9A1.5 1.5 0 0 1 2 13.25v-1.5a.75.75 0 0 1 .75-.75Z"/></svg>
							Download
						</button>
					{/if}
				{/if}
			{/if}
			<slot name="badges" />
		</div>
		<div class="flex flex-wrap items-center gap-1">
			{#each diffs as diff}
				<button
					class={classNames('badge badge-sm cursor-pointer', diffColors[diff.difficulty] || 'badge-neutral', {
						'badge-outline': diff.difficulty !== selectedDifficulty
					})}
					on:click={() => dispatch('diffSelect', { difficulty: diff.difficulty })}
				>
					{diff.difficulty === 'ExpertPlus' ? 'Expert+' : diff.difficulty}
				</button>
			{/each}
		</div>
		<div class="card-actions mt-1 justify-end items-center">
			<slot name="actions" />
			<Button
				label="Play"
				color={ThemeColors.Primary}
				size={ThemeSizes.Small}
				on:click={() => dispatch('play')}
			/>
		</div>
	</div>
</div>
