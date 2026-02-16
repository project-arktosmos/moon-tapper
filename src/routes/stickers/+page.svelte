<script lang="ts">
	import classNames from 'classnames';
	import manifest from '$data/sticker-manifest.json';
	import type { StickerCollection, StickerCharacter } from '$types/sticker.type';
	import {
		stickerThumbnailsStore,
		setThumbnail,
		getThumbnailKey
	} from '$services/sticker-thumbnails.service';
	import { stickersApi } from '$api/stickers';

	const collections = manifest.collections as StickerCollection[];

	let selectedCollectionIdx = $state(0);
	let selectedCategoryIdx = $state(0);
	let selectedSubcategoryIdx = $state(0);
	let search = $state('');
	let viewMode = $state<'characters' | 'sprites'>('characters');
	let pickingChar = $state<StickerCharacter | null>(null);
	let pickingSprites = $state<{ sprites: string[]; basePath: string } | null>(null);
	let deletedPaths = $state(new Set<string>());
	let deleting = $state(false);

	let collection = $derived(collections[selectedCollectionIdx]);
	let categories = $derived(collection.categories);
	let category = $derived(categories[selectedCategoryIdx]);
	let hasSubcategories = $derived(!!category?.subcategories?.length);
	let subcategory = $derived(
		hasSubcategories ? category.subcategories![selectedSubcategoryIdx] : null
	);
	let hasCharacters = $derived(collection.characters.length > 1);
	let showCategoryPicker = $derived(
		categories.length > 1 || (categories.length === 1 && categories[0].id !== 'all')
	);

	let filteredCharacters = $derived.by(() => {
		let chars = collection.characters.filter((c) => !deletedPaths.has(`${collection.id}:${c.path}`));
		if (search) {
			const q = search.toLowerCase();
			chars = chars.filter((c) => c.name.toLowerCase().includes(q));
		}
		return chars;
	});

	let currentSprites = $derived.by(() => {
		let sprites: string[];
		let basePath: string;

		if (hasSubcategories && subcategory) {
			sprites = subcategory.sprites;
			basePath = `${collection.basePath}/${subcategory.path}`;
		} else if (category?.sprites) {
			sprites = category.sprites;
			basePath = category.path
				? `${collection.basePath}/${category.path}`
				: collection.basePath;
		} else {
			sprites = [];
			basePath = collection.basePath;
		}

		if (search) {
			const q = search.toLowerCase();
			sprites = sprites.filter((s) => s.toLowerCase().includes(q));
		}

		return { sprites, basePath };
	});

	function encodePath(path: string): string {
		return path
			.split('/')
			.map((s) => encodeURIComponent(s))
			.join('/');
	}

	function spriteLabel(sprite: string): string {
		return sprite.replace(/\.(png|gif)$/i, '').replace(/[_-]/g, ' ');
	}

	function collectionBase(col: StickerCollection): string {
		return col.basePath.replace(/^\/stickers\//, '');
	}

	function getCharThumbnailUrl(char: StickerCharacter): string {
		const key = getThumbnailKey(collection.id, char.path);
		const override = $stickerThumbnailsStore[key];
		if (override) {
			return encodePath(`${collection.basePath}/${char.path}/${override}`);
		}
		return encodePath(`${collection.basePath}/${char.thumbnail}`);
	}

	function selectCollection(idx: number) {
		selectedCollectionIdx = idx;
		selectedCategoryIdx = 0;
		selectedSubcategoryIdx = 0;
		search = '';
		viewMode = collections[idx].characters.length > 1 ? 'characters' : 'sprites';
	}

	function selectCategory(idx: number) {
		selectedCategoryIdx = idx;
		selectedSubcategoryIdx = 0;
	}

	function openCharacterPicker(char: StickerCharacter) {
		pickingChar = char;

		for (const cat of categories) {
			if (cat.subcategories) {
				for (const sub of cat.subcategories) {
					if (sub.path === char.path) {
						pickingSprites = {
							sprites: sub.sprites,
							basePath: `${collection.basePath}/${sub.path}`
						};
						return;
					}
				}
			} else if (cat.path === char.path) {
				pickingSprites = {
					sprites: cat.sprites || [],
					basePath: `${collection.basePath}/${cat.path}`
				};
				return;
			}
		}
	}

	function pickSprite(sprite: string) {
		if (!pickingChar) return;
		setThumbnail(collection.id, pickingChar.path, sprite);
		pickingChar = null;
		pickingSprites = null;
	}

	function closePicker() {
		pickingChar = null;
		pickingSprites = null;
	}

	function openCharacterSprites(char: StickerCharacter) {
		closePicker();
		for (let ci = 0; ci < categories.length; ci++) {
			const cat = categories[ci];
			if (cat.subcategories) {
				for (let si = 0; si < cat.subcategories.length; si++) {
					if (cat.subcategories[si].path === char.path) {
						selectedCategoryIdx = ci;
						selectedSubcategoryIdx = si;
						viewMode = 'sprites';
						search = '';
						return;
					}
				}
			} else if (cat.path === char.path) {
				selectedCategoryIdx = ci;
				viewMode = 'sprites';
				search = '';
				return;
			}
		}
	}

	async function requestDelete(char: StickerCharacter) {
		if (deleting) return;
		deleting = true;
		try {
			await stickersApi.deleteCharacter(collectionBase(collection), char.path);
			deletedPaths = new Set([...deletedPaths, `${collection.id}:${char.path}`]);
			if (pickingChar?.path === char.path) {
				closePicker();
			}
		} catch (err) {
			console.error('Failed to delete character:', err);
		} finally {
			deleting = false;
		}
	}
</script>

<div class="flex h-full flex-col">
	<h1 class="mb-4 text-3xl font-bold">Stickers</h1>

	<!-- Collection tabs -->
	<div role="tablist" class="tabs tabs-bordered mb-4">
		{#each collections as col, idx}
			<button
				role="tab"
				class={classNames('tab', { 'tab-active': idx === selectedCollectionIdx })}
				onclick={() => selectCollection(idx)}
			>
				{col.name}
				<span class="badge badge-sm ml-2">{col.count}</span>
			</button>
		{/each}
	</div>

	<!-- View mode toggle + search -->
	<div class="mb-4 flex flex-wrap items-center gap-3">
		{#if hasCharacters}
			<div class="join">
				<button
					class={classNames('join-item btn btn-sm', {
						'btn-active': viewMode === 'characters'
					})}
					onclick={() => (viewMode = 'characters')}
				>
					Characters
				</button>
				<button
					class={classNames('join-item btn btn-sm', {
						'btn-active': viewMode === 'sprites'
					})}
					onclick={() => (viewMode = 'sprites')}
				>
					All Sprites
				</button>
			</div>
		{/if}

		{#if viewMode === 'sprites' && showCategoryPicker}
			<select
				class="select select-bordered select-sm w-full max-w-xs"
				value={selectedCategoryIdx}
				onchange={(e) => selectCategory(Number((e.target as HTMLSelectElement).value))}
			>
				{#each categories as cat, idx}
					<option value={idx}>{cat.name} ({cat.count})</option>
				{/each}
			</select>
		{/if}

		<input
			type="text"
			placeholder={viewMode === 'characters' ? 'Search characters...' : 'Search sprites...'}
			class="input input-bordered input-sm w-full max-w-xs"
			bind:value={search}
		/>

		<span class="text-sm opacity-60">
			{#if viewMode === 'characters'}
				{filteredCharacters.length} characters
			{:else}
				{currentSprites.sprites.length} sprites
			{/if}
		</span>
	</div>

	<!-- Subcategory tabs (sprites view only) -->
	{#if viewMode === 'sprites' && hasSubcategories}
		<div class="mb-4 flex flex-wrap gap-1">
			{#each category.subcategories! as sub, idx}
				<button
					class={classNames('btn btn-xs', {
						'btn-primary': idx === selectedSubcategoryIdx,
						'btn-ghost': idx !== selectedSubcategoryIdx
					})}
					onclick={() => (selectedSubcategoryIdx = idx)}
				>
					{sub.name}
					<span class="badge badge-xs ml-1">{sub.count}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Content grid -->
	<div class="flex-1 overflow-auto">
		{#if viewMode === 'characters'}
			{#if filteredCharacters.length === 0}
				<div class="flex items-center justify-center py-12 opacity-50">
					No characters found
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
					{#each filteredCharacters as char}
						<div class="group relative flex flex-col items-center gap-1 rounded-lg bg-base-200 p-3 transition-colors hover:bg-base-300">
							<button
								class="flex cursor-pointer flex-col items-center gap-1"
								onclick={() => openCharacterPicker(char)}
							>
								<img
									src={getCharThumbnailUrl(char)}
									alt={char.name}
									class="h-32 w-32 object-contain"
									loading="lazy"
								/>
								<span class="line-clamp-2 text-center text-xs leading-tight">
									{char.name}
								</span>
							</button>
							<button
								class="btn btn-circle btn-error btn-xs absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
								onclick={() => requestDelete(char)}
								title="Delete {char.name}"
							>
								&#x2715;
							</button>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			{#if currentSprites.sprites.length === 0}
				<div class="flex items-center justify-center py-12 opacity-50">
					No sprites found
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
					{#each currentSprites.sprites as sprite}
						<div class="flex flex-col items-center gap-1 rounded-lg bg-base-200 p-2">
							<img
								src={encodePath(`${currentSprites.basePath}/${sprite}`)}
								alt={spriteLabel(sprite)}
								class="h-32 w-32 object-contain"
								loading="lazy"
							/>
							<span class="line-clamp-2 text-center text-[10px] leading-tight opacity-70">
								{spriteLabel(sprite)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Thumbnail picker modal -->
{#if pickingChar && pickingSprites}
	<div class="modal modal-open">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={closePicker}></div>
		<div class="modal-box max-w-4xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-bold">
					Pick thumbnail for {pickingChar.name}
				</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={closePicker}>
					&#x2715;
				</button>
			</div>

			<div class="grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 md:grid-cols-5">
				{#each pickingSprites.sprites as sprite}
					<button
						class="flex cursor-pointer flex-col items-center gap-1 rounded-lg bg-base-200 p-2 transition-colors hover:bg-primary hover:bg-opacity-20"
						onclick={() => pickSprite(sprite)}
					>
						<img
							src={encodePath(`${pickingSprites.basePath}/${sprite}`)}
							alt={spriteLabel(sprite)}
							class="h-32 w-32 object-contain"
							loading="lazy"
						/>
						<span class="line-clamp-1 text-center text-[10px] leading-tight opacity-70">
							{spriteLabel(sprite)}
						</span>
					</button>
				{/each}
			</div>

			<div class="modal-action">
				<button class="btn btn-sm" onclick={() => openCharacterSprites(pickingChar!)}>
					View all sprites
				</button>
				<button class="btn btn-sm btn-error" onclick={() => requestDelete(pickingChar!)}>
					Delete character
				</button>
				<button class="btn btn-sm btn-ghost" onclick={closePicker}>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

