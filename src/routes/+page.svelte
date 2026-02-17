<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { isTauri } from '$utils/isTauri';
	import routes from '$lib/routes.json';

	onMount(() => {
		if (!isTauri()) goto('/search', { replaceState: true });
	});
</script>

<div class="max-w-4xl">
	<h1 class="mb-4 text-4xl font-bold">Welcome</h1>
	<p class="mb-8 text-lg opacity-70">
		Moon Tapper desktop application with auto-generated navigation.
	</p>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each routes.filter((r) => r.path !== '/') as route}
			<a href="{base}{route.path}" class="card bg-base-200 transition-shadow hover:shadow-lg active:shadow-lg">
				<div class="card-body">
					<h2 class="card-title">{route.name}</h2>
					<p class="text-sm opacity-60">{route.path}</p>
				</div>
			</a>
		{/each}
	</div>

	{#if routes.length <= 1}
		<div class="alert mt-8">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="h-6 w-6 shrink-0 stroke-info"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<div>
				<h3 class="font-bold">No additional routes found</h3>
				<p class="text-sm">
					Add new routes by creating <code class="badge badge-ghost">+page.svelte</code> files in
					<code class="badge badge-ghost">src/routes/</code> subdirectories.
				</p>
			</div>
		</div>
	{/if}
</div>
