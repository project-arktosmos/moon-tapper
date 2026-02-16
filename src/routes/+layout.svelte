<script lang="ts">
	import '../css/app.css';
	import '$services/i18n';
	import routes from '$lib/routes.json';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { initTheme } from '$services/theme';

	let { children } = $props();

	onMount(() => {
		initTheme();
	});
</script>

<div class="drawer lg:drawer-open">
	<input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<!-- Navbar for mobile -->
		<div class="navbar bg-base-200 lg:hidden">
			<div class="flex-none">
				<label for="sidebar-drawer" class="btn btn-square btn-ghost drawer-button">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block h-5 w-5 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						></path>
					</svg>
				</label>
			</div>
			<div class="flex-1">
				<span class="text-xl font-bold">Tauri Svelte</span>
			</div>
		</div>

		<!-- Page content -->
		<main class="flex-1 overflow-auto p-6">
			{@render children?.()}
		</main>
	</div>

	<div class="drawer-side">
		<label for="sidebar-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 min-h-full w-64 p-4">
			<div class="mb-6">
				<h2 class="text-xl font-bold">Tauri Svelte</h2>
				<p class="text-sm opacity-60">Navigation</p>
			</div>

			<ul class="menu w-full">
				{#each routes as route}
					<li>
						<a
							href={route.path}
							class:active={$page.url.pathname === route.path}
						>
							{route.name}
						</a>
					</li>
				{/each}
			</ul>
		</aside>
	</div>
</div>
