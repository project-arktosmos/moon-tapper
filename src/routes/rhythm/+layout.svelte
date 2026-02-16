<script lang="ts">
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';

	let { children } = $props();

	const tabs = [
		{ path: '/search', label: 'rhythm.nav.browse' },
		{ path: '/rhythm/playlists', label: 'rhythm.nav.playlists' },
		{ path: '/rhythm/scores', label: 'rhythm.nav.scores' },
		{ path: '/rhythm/settings', label: 'rhythm.nav.settings' }
	];

	let isPlayPage = $derived($page.url.pathname.startsWith('/rhythm/play'));
</script>

<div class="mx-auto max-w-6xl">
	{#if !isPlayPage}
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">{$_('rhythm.title')}</h1>
				<p class="text-sm opacity-60">{$_('rhythm.subtitle')}</p>
			</div>
		</div>

		<div role="tablist" class="tabs tabs-bordered mb-6">
			{#each tabs as tab}
				<a
					href={tab.path}
					role="tab"
					class={classNames('tab', {
						'tab-active': $page.url.pathname === tab.path
					})}
				>
					{$_(tab.label)}
				</a>
			{/each}
		</div>
	{/if}

	{@render children?.()}
</div>
