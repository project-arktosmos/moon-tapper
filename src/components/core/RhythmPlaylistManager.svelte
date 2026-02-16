<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { save } from '@tauri-apps/plugin-dialog';
	import { listen } from '@tauri-apps/api/event';
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import TrackGrid from '$components/core/TrackGrid.svelte';
	import TrackItem from '$components/core/TrackItem.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { rhythmPlaylistsService } from '$services/rhythm-playlists.service';
	import { playlistAdapter } from '$adapters/classes/playlist.adapter';
	import { lyricsApi, type LyricsFetchResult } from '$api/lyrics';
	import { FAVORITES_PLAYLIST_ID, type RhythmPlaylist, type PlaylistTrack } from '$types/rhythm.type';

	const dispatch = createEventDispatcher<{
		select: { track: PlaylistTrack; difficulty: string };
	}>();

	let selectedPlaylistId: string | null = $state(null);
	let renamingId: string | null = $state(null);
	let renameValue: string = $state('');
	let confirmDeleteId: string | null = $state(null);
	let selectedDiffs: Record<string, string> = $state({});
	let importError: string | null = $state(null);
	let fileInputEl: HTMLInputElement;

	// Batch lyrics fetch state
	let lyricsFetchTotal: number = $state(0);
	let lyricsFetchDone: number = $state(0);
	let lyricsFetchActive: boolean = $state(false);

	const playlistsStore = rhythmPlaylistsService.store;

	let selectedPlaylist: RhythmPlaylist | null = $derived(
		selectedPlaylistId
			? $playlistsStore.find((p: RhythmPlaylist) => p.id === selectedPlaylistId) || null
			: null
	);

	function handleCreatePlaylist() {
		const now = new Date().toISOString();
		const playlist: RhythmPlaylist = {
			id: crypto.randomUUID(),
			name: $_('rhythm.playlists.defaultName'),
			tracks: [],
			createdAt: now,
			updatedAt: now
		};
		rhythmPlaylistsService.add(playlist);
	}

	function handleOpenPlaylist(id: string) {
		selectedPlaylistId = id;
		selectedDiffs = {};
	}

	function handleBack() {
		selectedPlaylistId = null;
		confirmDeleteId = null;
		renamingId = null;
	}

	function handleStartRename(playlist: RhythmPlaylist) {
		renamingId = playlist.id;
		renameValue = playlist.name;
	}

	function handleRenameConfirm(playlist: RhythmPlaylist) {
		if (renameValue.trim()) {
			rhythmPlaylistsService.update({
				...playlist,
				name: renameValue.trim(),
				updatedAt: new Date().toISOString()
			});
		}
		renamingId = null;
	}

	function handleRenameKeydown(e: KeyboardEvent, playlist: RhythmPlaylist) {
		if (e.key === 'Enter') handleRenameConfirm(playlist);
		if (e.key === 'Escape') renamingId = null;
	}

	function handleDeleteConfirm(playlist: RhythmPlaylist) {
		rhythmPlaylistsService.remove(playlist);
		confirmDeleteId = null;
		if (selectedPlaylistId === playlist.id) selectedPlaylistId = null;
	}

	function handleRemoveTrack(playlist: RhythmPlaylist, trackId: string) {
		rhythmPlaylistsService.update({
			...playlist,
			tracks: playlist.tracks.filter((t) => t.id !== trackId),
			updatedAt: new Date().toISOString()
		});
	}

	function handleGridDiffSelect(e: CustomEvent<{ id: string; difficulty: string }>) {
		selectedDiffs = { ...selectedDiffs, [e.detail.id]: e.detail.difficulty };
	}

	function handleGridPlay(e: CustomEvent<{ item: PlaylistTrack; difficulty: string }>) {
		dispatch('select', { track: e.detail.item, difficulty: e.detail.difficulty });
	}

	async function handleExportPlaylist(playlist: RhythmPlaylist) {
		const defaultName = `${playlist.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
		const path = await save({
			defaultPath: defaultName,
			filters: [{ name: 'JSON', extensions: ['json'] }]
		});
		if (!path) return;

		const exportData = playlistAdapter.toExportJSON(playlist);
		const json = JSON.stringify(exportData, null, 2);
		await invoke('write_text_file', { path, content: json });
	}

	function handleImportClick() {
		importError = null;
		fileInputEl.click();
	}

	function handleImportFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const json = JSON.parse(reader.result as string);
				const playlist = playlistAdapter.fromExportJSON(json);
				rhythmPlaylistsService.add(playlist);
				importError = null;
			} catch {
				importError = $_('rhythm.playlists.importError');
			}
			input.value = '';
		};
		reader.readAsText(file);
	}

	async function handleFetchAllLyrics(playlist: RhythmPlaylist) {
		if (lyricsFetchActive || playlist.tracks.length === 0) return;

		// Determine which tracks actually need fetching (skip cached ones)
		const toFetch: PlaylistTrack[] = [];
		for (const track of playlist.tracks) {
			const cached = await lyricsApi.cacheHas(track.songName, track.songAuthorName);
			if (cached === null) {
				toFetch.push(track);
			}
		}

		if (toFetch.length === 0) return;

		lyricsFetchTotal = toFetch.length;
		lyricsFetchDone = 0;
		lyricsFetchActive = true;

		// Collect cache keys we're waiting for
		const pendingKeys = new Set<string>();

		const unlisten = await listen<LyricsFetchResult>('lyrics:fetch-result', (event) => {
			if (pendingKeys.delete(event.payload.cacheKey)) {
				lyricsFetchDone++;
				if (pendingKeys.size === 0) {
					lyricsFetchActive = false;
					unlisten();
				}
			}
		});

		// Enqueue all tracks
		for (const track of toFetch) {
			try {
				const cacheKey = await lyricsApi.fetch(
					track.songName,
					track.songAuthorName,
					null,
					track.duration
				);
				pendingKeys.add(cacheKey);
			} catch {
				lyricsFetchDone++;
			}
		}

		// If all enqueues failed or set was already empty
		if (pendingKeys.size === 0) {
			lyricsFetchActive = false;
			unlisten();
		}
	}
</script>

{#if selectedPlaylist}
	<!-- Detail view -->
	<div class="flex flex-col gap-4">
		<div class="flex items-center gap-3">
			<button class="btn btn-ghost btn-sm" on:click={handleBack}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
					<path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clip-rule="evenodd" />
				</svg>
				{$_('rhythm.playlists.back')}
			</button>
			<h2 class="text-xl font-bold flex-1">{selectedPlaylist.name}</h2>
			<span class="badge badge-ghost">{selectedPlaylist.tracks.length} tracks</span>
			{#if lyricsFetchActive}
				<span class="flex items-center gap-2 text-sm opacity-60">
					<span class="loading loading-spinner loading-xs"></span>
					{$_('rhythm.lyrics.fetching')} {lyricsFetchDone}/{lyricsFetchTotal}
				</span>
			{:else if selectedPlaylist.tracks.length > 0}
				<Button
					label={$_('rhythm.lyrics.fetchAll')}
					color={ThemeColors.Accent}
					size={ThemeSizes.Small}
					outline
					on:click={() => handleFetchAllLyrics(selectedPlaylist)}
				/>
			{/if}
		</div>

		{#if selectedPlaylist.tracks.length === 0}
			<div class="py-12 text-center opacity-60">
				{$_('rhythm.playlists.emptyPlaylist')}
			</div>
		{:else}
			<TrackGrid
				items={selectedPlaylist.tracks}
				{selectedDiffs}
				on:diffSelect={handleGridDiffSelect}
				on:play={handleGridPlay}
			>
				<svelte:fragment slot="actions" let:item>
					<button
						class="btn btn-ghost btn-sm text-error"
						on:click={() => handleRemoveTrack(selectedPlaylist, item.id)}
					>
						{$_('rhythm.playlists.removeTrack')}
					</button>
				</svelte:fragment>
			</TrackGrid>
		{/if}
	</div>
{:else}
	<!-- List view -->
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">{$_('rhythm.playlists.title')}</h2>
			<div class="flex gap-2">
				<Button
					label={$_('rhythm.playlists.importPlaylist')}
					color={ThemeColors.Neutral}
					size={ThemeSizes.Small}
					on:click={handleImportClick}
				/>
				<Button
					label={$_('rhythm.playlists.createPlaylist')}
					color={ThemeColors.Primary}
					size={ThemeSizes.Small}
					on:click={handleCreatePlaylist}
				/>
			</div>
		</div>
		<input
			type="file"
			accept=".json"
			class="hidden"
			bind:this={fileInputEl}
			on:change={handleImportFile}
		/>
		{#if importError}
			<div role="alert" class="alert alert-error">
				<span>{importError}</span>
			</div>
		{/if}

		{#if $playlistsStore.length === 0}
			<div class="py-12 text-center opacity-60">
				{$_('rhythm.playlists.noPlaylists')}
			</div>
		{:else}
			<div class="grid gap-4">
				{#each $playlistsStore as playlist (playlist.id)}
					<div
						class="card bg-base-200 shadow-sm cursor-pointer transition-colors hover:bg-base-300"
						on:click={() => handleOpenPlaylist(playlist.id)}
						on:keydown={(e) => e.key === 'Enter' && handleOpenPlaylist(playlist.id)}
						role="button"
						tabindex="0"
					>
						<div class="card-body gap-3 p-4">
							<div class="flex items-center gap-4">
								<div class="flex-1 min-w-0">
									{#if renamingId === playlist.id}
										<!-- svelte-ignore a11y-autofocus -->
										<input
											type="text"
											class="input input-bordered input-sm w-full max-w-xs"
											bind:value={renameValue}
											on:keydown={(e) => handleRenameKeydown(e, playlist)}
											on:blur={() => handleRenameConfirm(playlist)}
											on:click|stopPropagation
											autofocus
										/>
									{:else}
										<h3 class="font-semibold truncate">{playlist.name}</h3>
										<p class="text-sm opacity-50">
											{playlist.tracks.length} tracks
										</p>
									{/if}
								</div>
								<div class="flex items-center gap-1">
									{#if confirmDeleteId === playlist.id}
										<span class="text-sm text-error mr-1">{$_('rhythm.playlists.confirmDelete')}</span>
										<button
											class="btn btn-error btn-sm"
											on:click|stopPropagation={() => handleDeleteConfirm(playlist)}
										>
											{$_('rhythm.playlists.deletePlaylist')}
										</button>
										<button
											class="btn btn-ghost btn-sm"
											on:click|stopPropagation={() => (confirmDeleteId = null)}
										>
											{$_('common.cancel')}
										</button>
									{:else}
										<button
											class="btn btn-ghost btn-sm"
											title={$_('rhythm.playlists.exportPlaylist')}
											on:click|stopPropagation={() => handleExportPlaylist(playlist)}
										>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
												<path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
												<path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
											</svg>
										</button>
										<button
											class="btn btn-ghost btn-sm"
											title={$_('rhythm.playlists.renamePlaylist')}
											on:click|stopPropagation={() => handleStartRename(playlist)}
										>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
												<path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
												<path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
											</svg>
										</button>
										{#if playlist.id !== FAVORITES_PLAYLIST_ID}
											<button
												class="btn btn-ghost btn-sm text-error"
												title={$_('rhythm.playlists.deletePlaylist')}
												on:click|stopPropagation={() => (confirmDeleteId = playlist.id)}
											>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
													<path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 5.5a.75.75 0 0 1-1.49-.14l.5-5.5a.75.75 0 0 1 .79-.66Zm2.84 0a.75.75 0 0 1 .79.66l.5 5.5a.75.75 0 0 1-1.49.14l-.5-5.5a.75.75 0 0 1 .7-.8Z" clip-rule="evenodd" />
												</svg>
											</button>
										{/if}
									{/if}
								</div>
							</div>
							{#if playlist.tracks.length > 0}
								<div class="grid grid-cols-2 md:grid-cols-4 gap-2" on:click|stopPropagation on:keydown|stopPropagation>
									{#each playlist.tracks.slice(0, 4) as track (track.id)}
										<TrackItem
											coverURL={track.coverURL}
											songName={track.songName}
											songAuthorName={track.songAuthorName}
											bpm={track.bpm}
											duration={track.duration}
											diffs={track.diffs}
											selectedDifficulty={selectedDiffs[track.id] || track.diffs[0]?.difficulty || ''}
											on:diffSelect={(e) => (selectedDiffs = { ...selectedDiffs, [track.id]: e.detail.difficulty })}
											on:play={() => dispatch('select', { track, difficulty: selectedDiffs[track.id] || track.diffs[0]?.difficulty || 'Normal' })}
										/>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
