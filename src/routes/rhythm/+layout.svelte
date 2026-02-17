<script lang="ts">
	import classNames from 'classnames';
	import { page } from '$app/stores';

	let { children } = $props();

	const tabs = [
		{ path: '/search', label: 'Browse Songs' },
		{ path: '/rhythm/playlists', label: 'My Playlists' },
		{ path: '/rhythm/scores', label: 'Score History' },
		{ path: '/rhythm/controller', label: 'Controller' },
		{ path: '/rhythm/settings', label: 'Settings' }
	];

	let isPlayPage = $derived($page.url.pathname.startsWith('/rhythm/play'));
</script>

<div class="mx-auto max-w-6xl">
	{#if !isPlayPage}
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">Rhythm Game</h1>
				<p class="text-sm opacity-60">Search BeatSaver maps and play in Guitar Hero style</p>
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
					{tab.label}
				</a>
			{/each}
		</div>
	{/if}

	{@render children?.()}
</div>
