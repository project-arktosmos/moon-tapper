<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import TrackItem from '$components/core/TrackItem.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { beatsaverApi } from '$api/beatsaver';
	import { beatsaverCache } from '$api/beatsaver-cache';
	import { lyricsCache } from '$api/lyrics-cache';
	import RhythmPlaylistManager from '$components/core/RhythmPlaylistManager.svelte';
	import { rhythmPlaylistsService } from '$services/rhythm-playlists.service';
	import { playlistAdapter } from '$adapters/classes/playlist.adapter';
	import { FAVORITES_PLAYLIST_ID, type BeatSaverMap, type BeatSaverDiff, type PlaylistTrack, type RhythmPlaylist } from '$types/rhythm.type';

	interface MapCacheStatus {
		downloaded: boolean;
		lyricsStatus: 'cached' | 'not_found' | 'unknown';
	}

	const dispatch = createEventDispatcher<{
		select: { map: BeatSaverMap; difficulty: string; beatmapFilename: string };
		playlistSelect: { track: PlaylistTrack; difficulty: string };
	}>();

	type BrowseCategory = 'CURATED' | 'LAST_PUBLISHED' | 'UPDATED';

	const categories: { key: BrowseCategory; label: string }[] = [
		{ key: 'CURATED', label: 'rhythm.categories.curated' },
		{ key: 'LAST_PUBLISHED', label: 'rhythm.categories.latest' },
		{ key: 'UPDATED', label: 'rhythm.categories.updated' }
	];

	let query = $state('');
	let maps: BeatSaverMap[] = $state([]);
	let loading = $state(false);
	let error: string | null = $state(null);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	let selectedDiffs: Record<string, string> = $state({});
	let activeCategory: BrowseCategory = $state('CURATED');
	let cacheStatus: Record<string, MapCacheStatus> = $state({});
	let browseMode: 'search' | 'playlists' = $state('search');
	let selectedPlaylists: Record<string, string> = $state({});

	const playlistsStore = rhythmPlaylistsService.store;

	onMount(() => {
		loadBrowseMaps(activeCategory);
	});

	async function loadBrowseMaps(category: BrowseCategory) {
		activeCategory = category;
		loading = true;
		error = null;
		try {
			const result = await beatsaverApi.getLatestMaps(category);
			maps = result.docs || [];
			checkCacheStatus(maps);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			maps = [];
		} finally {
			loading = false;
		}
	}

	async function checkCacheStatus(loadedMaps: BeatSaverMap[]) {
		const results: Record<string, MapCacheStatus> = {};
		await Promise.all(
			loadedMaps.map(async (map) => {
				try {
					const [downloaded, lyrics] = await Promise.all([
						beatsaverCache.hasDownloadedMap(map.id),
						lyricsCache.has(map.metadata.songName, map.metadata.songAuthorName)
					]);
					results[map.id] = {
						downloaded,
						lyricsStatus: lyrics === null ? 'unknown' : lyrics.hasLyrics ? 'cached' : 'not_found'
					};
				} catch {
					results[map.id] = { downloaded: false, lyricsStatus: 'unknown' };
				}
			})
		);
		cacheStatus = { ...cacheStatus, ...results };
	}

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		query = target.value;
		if (searchTimeout) clearTimeout(searchTimeout);
		if (query.trim().length < 2) {
			if (query.trim().length === 0) loadBrowseMaps(activeCategory);
			else maps = [];
			return;
		}
		searchTimeout = setTimeout(() => searchMaps(), 400);
	}

	async function searchMaps() {
		if (!query.trim()) return;
		loading = true;
		error = null;
		try {
			const result = await beatsaverApi.searchMaps(query);
			maps = result.docs || [];
			checkCacheStatus(maps);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			maps = [];
		} finally {
			loading = false;
		}
	}

	function getDiffs(map: BeatSaverMap): BeatSaverDiff[] {
		return map.versions?.[0]?.diffs || [];
	}

	function getSelectedDiff(map: BeatSaverMap): string {
		return selectedDiffs[map.id] || getDiffs(map)[0]?.difficulty || 'Normal';
	}

	function handleDiffSelect(mapId: string, diff: string) {
		selectedDiffs = { ...selectedDiffs, [mapId]: diff };
	}

	function handleSelect(map: BeatSaverMap) {
		const selectedDiff = getSelectedDiff(map);
		dispatch('select', { map, difficulty: selectedDiff, beatmapFilename: '' });
	}

	function getSelectedPlaylist(mapId: string): string {
		return selectedPlaylists[mapId] || FAVORITES_PLAYLIST_ID;
	}

	function handlePlaylistSelectChange(mapId: string, playlistId: string) {
		selectedPlaylists = { ...selectedPlaylists, [mapId]: playlistId };
	}

	function handleAddToPlaylist(map: BeatSaverMap, playlistId: string) {
		const playlist = rhythmPlaylistsService.exists(playlistId);
		if (!playlist) return;
		if (playlist.tracks.some((t) => t.id === map.id)) return;

		const track = playlistAdapter.fromBeatSaverMap(map);
		const updated: RhythmPlaylist = {
			...playlist,
			tracks: [...playlist.tracks, track],
			updatedAt: new Date().toISOString()
		};
		rhythmPlaylistsService.update(updated);
	}

	function handlePlaylistTrackSelect(
		e: CustomEvent<{ track: PlaylistTrack; difficulty: string }>
	) {
		dispatch('playlistSelect', e.detail);
	}

</script>

<div class="flex flex-col gap-4">
	<!-- Mode tabs -->
	<div role="tablist" class="tabs tabs-bordered">
		<button
			role="tab"
			class={classNames('tab', { 'tab-active': browseMode === 'search' })}
			on:click={() => (browseMode = 'search')}
		>
			{$_('rhythm.playlists.tabSearch')}
		</button>
		<button
			role="tab"
			class={classNames('tab', { 'tab-active': browseMode === 'playlists' })}
			on:click={() => (browseMode = 'playlists')}
		>
			{$_('rhythm.playlists.tabPlaylists')}
		</button>
	</div>

	{#if browseMode === 'playlists'}
		<RhythmPlaylistManager on:select={handlePlaylistTrackSelect} />
	{:else}
	<div class="flex gap-2">
		<input
			type="text"
			placeholder={$_('rhythm.searchPlaceholder')}
			value={query}
			on:input={handleSearchInput}
			on:keydown={(e) => e.key === 'Enter' && searchMaps()}
			class="input input-bordered flex-1"
		/>
		<Button
			label={$_('common.search')}
			color={ThemeColors.Primary}
			size={ThemeSizes.Medium}
			disabled={loading || query.trim().length < 2}
			on:click={searchMaps}
		/>
	</div>

	{#if !query.trim()}
		<div class="flex gap-2">
			{#each categories as cat}
				<button
					class={classNames('btn btn-sm', {
						'btn-primary': activeCategory === cat.key,
						'btn-ghost': activeCategory !== cat.key
					})}
					disabled={loading}
					on:click={() => loadBrowseMaps(cat.key)}
				>
					{$_(cat.label)}
				</button>
			{/each}
		</div>
	{/if}

	{#if error}
		<div role="alert" class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg text-primary"></span>
		</div>
	{:else if maps.length === 0 && query.trim().length >= 2}
		<div class="py-12 text-center opacity-60">
			{$_('rhythm.noResults')}
		</div>
	{:else if maps.length === 0}
		<div></div>
	{:else}
		<div class="grid gap-3">
			{#each maps as map (map.id)}
				{@const version = map.versions?.[0]}
				{@const status = cacheStatus[map.id]}
				{@const targetPlaylist = $playlistsStore.find((p) => p.id === getSelectedPlaylist(map.id))}
				<TrackItem
					coverURL={version?.coverURL || ''}
					songName={map.metadata.songName}
					songAuthorName={map.metadata.songAuthorName}
					levelAuthorName={map.metadata.levelAuthorName}
					bpm={map.metadata.bpm}
					duration={map.metadata.duration}
					diffs={getDiffs(map)}
					selectedDifficulty={getSelectedDiff(map)}
					on:diffSelect={(e) => handleDiffSelect(map.id, e.detail.difficulty)}
					on:play={() => handleSelect(map)}
				>
					<svelte:fragment slot="badges">
						{#if status?.downloaded}
							<span class="badge badge-success badge-sm gap-1" title={$_('rhythm.cached')}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM6.7 11.3l5-5a.7.7 0 0 0-1-1L6.2 9.8 5.3 8.9a.7.7 0 1 0-1 1l1.4 1.4a.7.7 0 0 0 1 0Z"/></svg>
								{$_('rhythm.downloaded')}
							</span>
						{/if}
						{#if status?.lyricsStatus === 'cached'}
							<span class="badge badge-accent badge-sm gap-1" title={$_('rhythm.lyrics.cached')}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V3Zm0 3h12v1H2V6Zm0 3h8v1H2V9Z"/></svg>
								{$_('rhythm.lyrics.title')}
							</span>
						{:else if status?.lyricsStatus === 'not_found'}
							<span class="badge badge-ghost badge-sm gap-1 opacity-50" title={$_('rhythm.lyrics.notFound')}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V3Zm0 3h12v1H2V6Zm0 3h8v1H2V9Z"/></svg>
								{$_('rhythm.lyrics.none')}
							</span>
						{/if}
					</svelte:fragment>
					<svelte:fragment slot="actions">
						<div class="join">
							<select
								class="select select-bordered select-sm join-item"
								value={getSelectedPlaylist(map.id)}
								on:change={(e) => handlePlaylistSelectChange(map.id, e.currentTarget.value)}
							>
								{#each $playlistsStore as playlist}
									<option value={playlist.id}>{playlist.name}</option>
								{/each}
							</select>
							{#if targetPlaylist?.tracks.some((t) => t.id === map.id)}
								<button class="btn btn-sm btn-success join-item" disabled>
									{$_('rhythm.playlists.added')}
								</button>
							{:else}
								<button
									class="btn btn-sm btn-ghost join-item"
									on:click={() => handleAddToPlaylist(map, getSelectedPlaylist(map.id))}
								>
									{$_('rhythm.playlists.add')}
								</button>
							{/if}
						</div>
					</svelte:fragment>
				</TrackItem>
			{/each}
		</div>
	{/if}
	{/if}
</div>
