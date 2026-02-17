<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { BeatSaverTag } from '$types/rhythm.type';
	import { BEATSAVER_TAG_GROUPS, TAG_LABELS } from '$data/beatsaver-tags';

	export let selectedTags: BeatSaverTag[] = [];
	export let excludedTags: BeatSaverTag[] = [];
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		toggle: { tag: BeatSaverTag; action: 'include' | 'exclude' | 'remove' };
	}>();

	function handleTagClick(tag: BeatSaverTag) {
		if (disabled) return;

		if (selectedTags.includes(tag)) {
			dispatch('toggle', { tag, action: 'exclude' });
		} else if (excludedTags.includes(tag)) {
			dispatch('toggle', { tag, action: 'remove' });
		} else {
			dispatch('toggle', { tag, action: 'include' });
		}
	}
</script>

<div class="flex flex-col gap-3">
	{#each BEATSAVER_TAG_GROUPS as group}
		<div class="flex flex-col gap-1">
			<span class="text-xs font-semibold uppercase tracking-wide opacity-50">
				{group.label}
			</span>
			<div class="flex flex-wrap gap-1">
				{#each group.tags as tag}
					<button
						class={classNames('badge cursor-pointer select-none transition-colors', {
							'badge-primary': selectedTags.includes(tag),
							'badge-error badge-outline line-through': excludedTags.includes(tag),
							'badge-ghost': !selectedTags.includes(tag) && !excludedTags.includes(tag)
						})}
						{disabled}
						on:click={() => handleTagClick(tag)}
					>
						{TAG_LABELS[tag] || tag}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
