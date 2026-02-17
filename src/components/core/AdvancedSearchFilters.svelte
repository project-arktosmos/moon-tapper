<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import TagSelector from '$components/core/TagSelector.svelte';
	import type {
		BeatSaverSearchFilters,
		BeatSaverSortOrder,
		BeatSaverLeaderboard,
		BeatSaverTag
	} from '$types/rhythm.type';

	export let filters: BeatSaverSearchFilters;
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		change: BeatSaverSearchFilters;
		clear: void;
	}>();

	const sortOptions: BeatSaverSortOrder[] = [
		'Rating',
		'Relevance',
		'Latest',
		'Curated',
		'Random',
		'Duration'
	];

	const leaderboardOptions: BeatSaverLeaderboard[] = ['All', 'Ranked', 'BeatLeader', 'ScoreSaber'];

	function emit(updated: Partial<BeatSaverSearchFilters>) {
		dispatch('change', { ...filters, ...updated });
	}

	function handleSortChange(e: Event) {
		emit({ sortOrder: (e.target as HTMLSelectElement).value as BeatSaverSortOrder });
	}

	function handleLeaderboardChange(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		emit({ leaderboard: val === '' ? null : (val as BeatSaverLeaderboard) });
	}

	function handleNumberInput(
		field: keyof BeatSaverSearchFilters,
		e: Event
	) {
		const val = (e.target as HTMLInputElement).value;
		emit({ [field]: val === '' ? null : Number(val) } as Partial<BeatSaverSearchFilters>);
	}

	function toggleBoolean(field: 'curated' | 'verified' | 'automapper') {
		const current = filters[field];
		emit({ [field]: current === null ? true : current === true ? false : null });
	}

	function boolLabel(val: boolean | null, label: string): string {
		if (val === true) return `${label}: on`;
		if (val === false) return `${label}: off`;
		return label;
	}

	function handleTagToggle(
		e: CustomEvent<{ tag: BeatSaverTag; action: 'include' | 'exclude' | 'remove' }>
	) {
		const { tag, action } = e.detail;
		let tags = filters.tags.filter((t) => t !== tag);
		let excludeTags = filters.excludeTags.filter((t) => t !== tag);

		if (action === 'include') {
			tags = [...tags, tag];
		} else if (action === 'exclude') {
			excludeTags = [...excludeTags, tag];
		}

		emit({ tags, excludeTags });
	}
</script>

<div class="flex flex-col gap-4 pt-2">
	<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
		<div class="form-control">
			<label class="label" for="sort-order">
				<span class="label-text text-sm">Sort By</span>
			</label>
			<select
				id="sort-order"
				class="select select-bordered select-sm"
				value={filters.sortOrder}
				{disabled}
				on:change={handleSortChange}
			>
				{#each sortOptions as opt}
					<option value={opt}>{opt}</option>
				{/each}
			</select>
		</div>
		<div class="form-control">
			<label class="label" for="leaderboard">
				<span class="label-text text-sm">Leaderboard</span>
			</label>
			<select
				id="leaderboard"
				class="select select-bordered select-sm"
				value={filters.leaderboard ?? ''}
				{disabled}
				on:change={handleLeaderboardChange}
			>
				<option value="">--</option>
				{#each leaderboardOptions as opt}
					<option value={opt}>{opt}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="form-control">
			<label class="label">
				<span class="label-text text-sm">BPM</span>
			</label>
			<div class="join w-full">
				<input
					type="number"
					placeholder="Min"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.minBpm ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('minBpm', e)}
				/>
				<input
					type="number"
					placeholder="Max"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.maxBpm ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('maxBpm', e)}
				/>
			</div>
		</div>

		<div class="form-control">
			<label class="label">
				<span class="label-text text-sm">Notes/Sec</span>
			</label>
			<div class="join w-full">
				<input
					type="number"
					placeholder="Min"
					step="0.1"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.minNps ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('minNps', e)}
				/>
				<input
					type="number"
					placeholder="Max"
					step="0.1"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.maxNps ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('maxNps', e)}
				/>
			</div>
		</div>

		<div class="form-control">
			<label class="label">
				<span class="label-text text-sm">Duration (s)</span>
			</label>
			<div class="join w-full">
				<input
					type="number"
					placeholder="Min"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.minDuration ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('minDuration', e)}
				/>
				<input
					type="number"
					placeholder="Max"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.maxDuration ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('maxDuration', e)}
				/>
			</div>
		</div>

		<div class="form-control">
			<label class="label">
				<span class="label-text text-sm">Rating</span>
			</label>
			<div class="join w-full">
				<input
					type="number"
					placeholder="Min"
					step="0.05"
					min="0"
					max="1"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.minRating ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('minRating', e)}
				/>
				<input
					type="number"
					placeholder="Max"
					step="0.05"
					min="0"
					max="1"
					class="input input-bordered input-sm join-item w-1/2"
					value={filters.maxRating ?? ''}
					{disabled}
					on:change={(e) => handleNumberInput('maxRating', e)}
				/>
			</div>
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		<button
			class={classNames('btn btn-sm', {
				'btn-primary': filters.curated === true,
				'btn-error btn-outline': filters.curated === false,
				'btn-ghost': filters.curated === null
			})}
			{disabled}
			on:click={() => toggleBoolean('curated')}
		>
			{boolLabel(filters.curated, 'Curated')}
		</button>
		<button
			class={classNames('btn btn-sm', {
				'btn-primary': filters.verified === true,
				'btn-error btn-outline': filters.verified === false,
				'btn-ghost': filters.verified === null
			})}
			{disabled}
			on:click={() => toggleBoolean('verified')}
		>
			{boolLabel(filters.verified, 'Verified')}
		</button>
		<button
			class={classNames('btn btn-sm', {
				'btn-primary': filters.automapper === true,
				'btn-error btn-outline': filters.automapper === false,
				'btn-ghost': filters.automapper === null
			})}
			{disabled}
			on:click={() => toggleBoolean('automapper')}
		>
			{boolLabel(filters.automapper, 'AI Maps')}
		</button>
	</div>

	<TagSelector
		selectedTags={filters.tags}
		excludedTags={filters.excludeTags}
		{disabled}
		on:toggle={handleTagToggle}
	/>

	<div class="flex justify-end">
		<button class="btn btn-ghost btn-sm" {disabled} on:click={() => dispatch('clear')}>
			Clear Filters
		</button>
	</div>
</div>
