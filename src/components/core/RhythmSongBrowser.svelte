<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import { beatsaverApi } from '$api/beatsaver';
	import type { BeatSaverMap, BeatSaverDiff } from '$types/rhythm.type';

	const dispatch = createEventDispatcher<{
		select: { map: BeatSaverMap; difficulty: string; beatmapFilename: string };
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
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			maps = [];
		} finally {
			loading = false;
		}
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

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	const diffColors: Record<string, string> = {
		Easy: 'badge-success',
		Normal: 'badge-info',
		Hard: 'badge-warning',
		Expert: 'badge-error',
		ExpertPlus: 'badge-secondary'
	};
</script>

<div class="flex flex-col gap-4">
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
				{@const diffs = getDiffs(map)}
				{@const selected = getSelectedDiff(map)}
				{@const version = map.versions?.[0]}
				<div class="card card-side bg-base-200 shadow-md">
					{#if version?.coverURL}
						<figure class="w-24 shrink-0">
							<img
								src={version.coverURL}
								alt={map.name}
								class="h-full w-full object-cover"
							/>
						</figure>
					{/if}
					<div class="card-body gap-1 p-4">
						<h3 class="card-title text-base">{map.metadata.songName}</h3>
						<p class="text-sm opacity-60">
							{map.metadata.songAuthorName}
							{#if map.metadata.levelAuthorName}
								<span class="opacity-40">/ mapped by {map.metadata.levelAuthorName}</span>
							{/if}
						</p>
						<div class="flex flex-wrap items-center gap-2">
							<span class="badge badge-ghost badge-sm">{Math.round(map.metadata.bpm)} BPM</span>
							<span class="badge badge-ghost badge-sm">{formatDuration(map.metadata.duration)}</span>
							{#each diffs as diff}
								<button
									class={classNames('badge badge-sm cursor-pointer', diffColors[diff.difficulty] || 'badge-neutral', {
										'badge-outline': diff.difficulty !== selected
									})}
									on:click={() => handleDiffSelect(map.id, diff.difficulty)}
								>
									{diff.difficulty === 'ExpertPlus' ? 'Expert+' : diff.difficulty}
								</button>
							{/each}
						</div>
						<div class="card-actions mt-1 justify-end">
							<Button
								label={$_('rhythm.play')}
								color={ThemeColors.Primary}
								size={ThemeSizes.Small}
								on:click={() => handleSelect(map)}
							/>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
