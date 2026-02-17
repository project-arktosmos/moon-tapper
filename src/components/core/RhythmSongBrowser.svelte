<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher, onMount } from 'svelte';
	import Button from '$components/core/Button.svelte';
	import TrackGrid from '$components/core/TrackGrid.svelte';
	import AdvancedSearchFilters from '$components/core/AdvancedSearchFilters.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { beatsaverApi } from '$api/beatsaver';
	import { lyricsApi } from '$api/lyrics';
	import { rhythmPlaylistsService } from '$services/rhythm-playlists.service';
	import { playlistAdapter } from '$adapters/classes/playlist.adapter';
	import {
		DEFAULT_SEARCH_FILTERS,
		FAVORITES_PLAYLIST_ID,
		type BeatSaverMap,
		type BeatSaverSearchFilters,
		type BeatSaverSearchPaginationInfo,
		type PlaylistTrack,
		type RhythmPlaylist
	} from '$types/rhythm.type';

	interface MapCacheStatus {
		downloaded: boolean;
		lyricsStatus: 'cached' | 'not_found' | 'unknown';
	}

	const dispatch = createEventDispatcher<{
		select: { map: BeatSaverMap; difficulty: string; beatmapFilename: string };
	}>();

	type BrowseCategory = 'CURATED' | 'LAST_PUBLISHED' | 'UPDATED';

	const categories: { key: BrowseCategory; label: string }[] = [
		{ key: 'CURATED', label: 'Curated' },
		{ key: 'LAST_PUBLISHED', label: 'Latest' },
		{ key: 'UPDATED', label: 'Recently Updated' }
	];

	let query = $state('');
	let maps: BeatSaverMap[] = $state([]);
	let loading = $state(false);
	let error: string | null = $state(null);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	let selectedDiffs: Record<string, string> = $state({});
	let activeCategory: BrowseCategory = $state('CURATED');
	let cacheStatus: Record<string, MapCacheStatus> = $state({});
	let selectedPlaylists: Record<string, string> = $state({});
	let currentPage = $state(0);
	let paginationInfo: BeatSaverSearchPaginationInfo | null = $state(null);
	let filters: BeatSaverSearchFilters = $state(structuredClone(DEFAULT_SEARCH_FILTERS));
	let showFilters = $state(false);

	let activeFilterCount = $derived(countActiveFilters(filters));
	let isSearchMode = $derived(query.trim().length > 0 || activeFilterCount > 0);

	let gridItems: PlaylistTrack[] = $derived(
		maps.map((map) => playlistAdapter.fromBeatSaverMap(map))
	);

	const playlistsStore = rhythmPlaylistsService.store;

	function countActiveFilters(f: BeatSaverSearchFilters): number {
		let count = 0;
		if (f.sortOrder !== 'Rating') count++;
		count += f.tags.length;
		count += f.excludeTags.length;
		if (f.minBpm !== null) count++;
		if (f.maxBpm !== null) count++;
		if (f.minNps !== null) count++;
		if (f.maxNps !== null) count++;
		if (f.minDuration !== null) count++;
		if (f.maxDuration !== null) count++;
		if (f.minRating !== null) count++;
		if (f.maxRating !== null) count++;
		if (f.curated !== null) count++;
		if (f.verified !== null) count++;
		if (f.automapper !== null) count++;
		if (f.from !== null) count++;
		if (f.to !== null) count++;
		if (f.leaderboard !== null) count++;
		return count;
	}

	onMount(() => {
		loadBrowseMaps(activeCategory);
	});

	async function loadBrowseMaps(category: BrowseCategory) {
		activeCategory = category;
		loading = true;
		error = null;
		paginationInfo = null;
		currentPage = 0;
		try {
			const result = await beatsaverApi.getLatestMaps(category);
			maps = result.docs || [];
			paginationInfo = result.info ?? null;
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
						beatsaverApi.hasDownloadedMap(map.id),
						lyricsApi.cacheHas(map.metadata.songName, map.metadata.songAuthorName)
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
		if (query.trim().length < 2 && activeFilterCount === 0) {
			if (query.trim().length === 0) loadBrowseMaps(activeCategory);
			else maps = [];
			paginationInfo = null;
			currentPage = 0;
			return;
		}
		if (query.trim().length >= 2 || activeFilterCount > 0) {
			searchTimeout = setTimeout(() => runSearch(0), 400);
		}
	}

	async function runSearch(page: number = 0) {
		if (!query.trim() && activeFilterCount === 0) return;
		loading = true;
		error = null;
		try {
			const result = await beatsaverApi.searchMaps(query, page, filters);
			maps = result.docs || [];
			paginationInfo = result.info ?? null;
			currentPage = page;
			checkCacheStatus(maps);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			maps = [];
			paginationInfo = null;
		} finally {
			loading = false;
		}
	}

	function goToPage(page: number) {
		runSearch(page);
	}

	function handleFilterChange(e: CustomEvent<BeatSaverSearchFilters>) {
		filters = e.detail;
		currentPage = 0;
		if (query.trim().length >= 2 || countActiveFilters(filters) > 0) {
			if (searchTimeout) clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => runSearch(0), 400);
		} else if (query.trim().length === 0 && countActiveFilters(filters) === 0) {
			loadBrowseMaps(activeCategory);
		}
	}

	function handleClearFilters() {
		filters = structuredClone(DEFAULT_SEARCH_FILTERS);
		currentPage = 0;
		if (query.trim().length >= 2) {
			runSearch(0);
		} else if (query.trim().length === 0) {
			loadBrowseMaps(activeCategory);
		}
	}

	function handleGridDiffSelect(e: CustomEvent<{ id: string; difficulty: string }>) {
		selectedDiffs = { ...selectedDiffs, [e.detail.id]: e.detail.difficulty };
	}

	function handleGridPlay(e: CustomEvent<{ item: PlaylistTrack; difficulty: string }>) {
		const map = maps.find((m) => m.id === e.detail.item.id);
		if (!map) return;
		dispatch('select', { map, difficulty: e.detail.difficulty, beatmapFilename: '' });
	}

	function getSelectedPlaylist(mapId: string): string {
		return selectedPlaylists[mapId] || FAVORITES_PLAYLIST_ID;
	}

	function handlePlaylistSelectChange(mapId: string, playlistId: string) {
		selectedPlaylists = { ...selectedPlaylists, [mapId]: playlistId };
	}

	function handleAddToPlaylist(track: PlaylistTrack, playlistId: string) {
		const playlist = rhythmPlaylistsService.exists(playlistId);
		if (!playlist) return;
		if (playlist.tracks.some((t) => t.id === track.id)) return;

		const updated: RhythmPlaylist = {
			...playlist,
			tracks: [...playlist.tracks, track],
			updatedAt: new Date().toISOString()
		};
		rhythmPlaylistsService.update(updated);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex gap-2">
		<input
			type="text"
			placeholder="Search songs on BeatSaver..."
			value={query}
			on:input={handleSearchInput}
			on:keydown={(e) => e.key === 'Enter' && runSearch(0)}
			class="input input-bordered flex-1"
		/>
		<Button
			label="Search"
			color={ThemeColors.Primary}
			size={ThemeSizes.Medium}
			disabled={loading || (query.trim().length < 2 && activeFilterCount === 0)}
			on:click={() => runSearch(0)}
		/>
	</div>

	<div class="collapse collapse-arrow rounded-box bg-base-200">
		<input type="checkbox" bind:checked={showFilters} />
		<div class="collapse-title flex items-center gap-2 text-sm font-medium">
			Advanced Filters
			{#if activeFilterCount > 0}
				<span class="badge badge-primary badge-sm">{activeFilterCount}</span>
			{/if}
		</div>
		<div class="collapse-content">
			<AdvancedSearchFilters
				{filters}
				disabled={loading}
				on:change={handleFilterChange}
				on:clear={handleClearFilters}
			/>
		</div>
	</div>

	{#if !isSearchMode}
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
					{cat.label}
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
	{:else if maps.length === 0 && isSearchMode}
		<div class="py-12 text-center opacity-60">
			No songs found. Try a different search.
		</div>
	{:else if maps.length === 0}
		<div></div>
	{:else}
		<TrackGrid
			items={gridItems}
			{selectedDiffs}
			on:diffSelect={handleGridDiffSelect}
			on:play={handleGridPlay}
		>
			<svelte:fragment slot="badges" let:item>
				{@const status = cacheStatus[item.id]}
				{#if status?.downloaded}
					<span class="badge badge-success badge-sm gap-1" title="Song data cached locally">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM6.7 11.3l5-5a.7.7 0 0 0-1-1L6.2 9.8 5.3 8.9a.7.7 0 1 0-1 1l1.4 1.4a.7.7 0 0 0 1 0Z"/></svg>
						Downloaded
					</span>
				{/if}
				{#if status?.lyricsStatus === 'cached'}
					<span class="badge badge-accent badge-sm gap-1" title="Lyrics available locally">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V3Zm0 3h12v1H2V6Zm0 3h8v1H2V9Z"/></svg>
						Lyrics
					</span>
				{:else if status?.lyricsStatus === 'not_found'}
					<span class="badge badge-ghost badge-sm gap-1 opacity-50" title="No lyrics found">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3 w-3"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V3Zm0 3h12v1H2V6Zm0 3h8v1H2V9Z"/></svg>
						No lyrics
					</span>
				{/if}
			</svelte:fragment>
			<svelte:fragment slot="actions" let:item>
				{@const targetPlaylist = $playlistsStore.find((p) => p.id === getSelectedPlaylist(item.id))}
				<div class="join">
					<select
						class="select select-bordered select-sm join-item"
						value={getSelectedPlaylist(item.id)}
						on:change={(e) => handlePlaylistSelectChange(item.id, e.currentTarget.value)}
					>
						{#each $playlistsStore as playlist}
							<option value={playlist.id}>{playlist.name}</option>
						{/each}
					</select>
					{#if targetPlaylist?.tracks.some((t) => t.id === item.id)}
						<button class="btn btn-sm btn-success join-item" disabled>
							Added
						</button>
					{:else}
						<button
							class="btn btn-sm btn-ghost join-item"
							on:click={() => handleAddToPlaylist(item, getSelectedPlaylist(item.id))}
						>
							Add
						</button>
					{/if}
				</div>
			</svelte:fragment>
		</TrackGrid>

		{#if paginationInfo && paginationInfo.pages > 1}
			<div class="flex items-center justify-center gap-2 pt-2">
				<button
					class="btn btn-sm btn-ghost"
					disabled={currentPage <= 0 || loading}
					on:click={() => goToPage(currentPage - 1)}
				>
					Previous
				</button>
				<span class="text-sm opacity-70">
					Page {currentPage + 1} of {paginationInfo.pages}
				</span>
				<button
					class="btn btn-sm btn-ghost"
					disabled={currentPage >= paginationInfo.pages - 1 || loading}
					on:click={() => goToPage(currentPage + 1)}
				>
					Next
				</button>
			</div>
			<div class="text-center text-xs opacity-50">
				{paginationInfo.total} results
			</div>
		{/if}
	{/if}
</div>
