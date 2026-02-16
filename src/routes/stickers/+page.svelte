<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import manifest from '$data/sticker-manifest.json';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { StickerCollection, StickerManifest } from '$types/sticker.type';
	import { stickersDbApi } from '$api/stickers-db';

	const collections = manifest.collections as StickerCollection[];
	const PAGE_SIZE = 60;

	onMount(() => {
		stickersDbApi.seedFromManifest(manifest as StickerManifest);
	});

	interface FlatSticker {
		url: string;
		label: string;
		category: string;
	}

	function buildFlatList(): FlatSticker[] {
		const items: FlatSticker[] = [];

		for (const col of collections) {
			for (const cat of col.categories) {
				if (cat.subcategories?.length) {
					for (const sub of cat.subcategories) {
						const basePath = `${col.basePath}/${sub.path}`;
						const category = `${col.name} > ${sub.name}`;
						for (const sprite of sub.sprites) {
							items.push({
								url: encodePath(`${basePath}/${sprite}`),
								label: spriteLabel(sprite),
								category
							});
						}
					}
				} else if (cat.sprites?.length) {
					const basePath = cat.path
						? `${col.basePath}/${cat.path}`
						: col.basePath;
					const category =
						cat.name === 'All' ? col.name : `${col.name} > ${cat.name}`;
					for (const sprite of cat.sprites) {
						items.push({
							url: encodePath(`${basePath}/${sprite}`),
							label: spriteLabel(sprite),
							category
						});
					}
				}
			}
		}

		return items;
	}

	const allStickers = buildFlatList();

	let search = $state('');
	let page = $state(0);
	let cols = $state(6);

	let filtered = $derived.by(() => {
		if (!search) return allStickers;
		const q = search.toLowerCase();
		return allStickers.filter(
			(s) => s.label.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
		);
	});

	let totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	let clampedPage = $derived(Math.min(page, totalPages - 1));
	let pageStickers = $derived(
		filtered.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE)
	);

	function encodePath(path: string): string {
		return path
			.split('/')
			.map((s) => encodeURIComponent(s))
			.join('/');
	}

	function spriteLabel(sprite: string): string {
		return sprite.replace(/\.(png|gif)$/i, '').replace(/[_-]/g, ' ');
	}

	function goToPage(p: number) {
		page = Math.max(0, Math.min(p, totalPages - 1));
	}

	$effect(() => {
		// Reset to first page when search changes
		search;
		page = 0;
	});
</script>

<div class="flex h-full flex-col">
	<h1 class="mb-4 text-3xl font-bold">Stickers</h1>

	<!-- Search + count -->
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<input
			type="text"
			placeholder="Search stickers..."
			class="input input-bordered input-sm w-full max-w-xs"
			bind:value={search}
		/>
		<span class="text-sm opacity-60">
			{filtered.length} stickers
		</span>

		<div class="flex items-center gap-2">
			<span class="text-xs opacity-60">{cols}</span>
			<input
				type="range"
				min="2"
				max="12"
				class="range range-xs w-28"
				bind:value={cols}
			/>
		</div>
	</div>

	<!-- Sticker grid -->
	<div class="flex-1 overflow-auto">
		{#if pageStickers.length === 0}
			<div class="flex items-center justify-center py-12 opacity-50">
				No stickers found
			</div>
		{:else}
			<div class="grid gap-3" style:grid-template-columns="repeat({cols}, minmax(0, 1fr))">
				{#each pageStickers as sticker}
					<div class="flex flex-col items-center gap-1">
						<StickerItem url={sticker.url} label={sticker.label} />
						<span class="line-clamp-1 text-center text-[10px] leading-tight opacity-70">
							{sticker.label}
						</span>
						<span class="badge badge-ghost badge-xs line-clamp-1 max-w-full">
							{sticker.category}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="mt-4 flex items-center justify-center gap-1">
			<button
				class="btn btn-sm"
				disabled={clampedPage === 0}
				onclick={() => goToPage(0)}
			>
				&laquo;
			</button>
			<button
				class="btn btn-sm"
				disabled={clampedPage === 0}
				onclick={() => goToPage(clampedPage - 1)}
			>
				&lsaquo;
			</button>

			{#each Array.from({ length: totalPages }, (_, i) => i) as p}
				{#if p === 0 || p === totalPages - 1 || (p >= clampedPage - 2 && p <= clampedPage + 2)}
					<button
						class={classNames('btn btn-sm', {
							'btn-active': p === clampedPage
						})}
						onclick={() => goToPage(p)}
					>
						{p + 1}
					</button>
				{:else if p === clampedPage - 3 || p === clampedPage + 3}
					<span class="px-1 opacity-50">...</span>
				{/if}
			{/each}

			<button
				class="btn btn-sm"
				disabled={clampedPage === totalPages - 1}
				onclick={() => goToPage(clampedPage + 1)}
			>
				&rsaquo;
			</button>
			<button
				class="btn btn-sm"
				disabled={clampedPage === totalPages - 1}
				onclick={() => goToPage(totalPages - 1)}
			>
				&raquo;
			</button>
		</div>
	{/if}
</div>
