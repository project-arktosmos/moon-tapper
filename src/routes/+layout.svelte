<script lang="ts">
	import '../css/app.css';
	import routes from '$lib/routes.json';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { initTheme } from '$services/theme';
	import { isTauri } from '$utils/isTauri';
	import Navbar from '$components/core/Navbar.svelte';

	let { children } = $props();

	const showSidebar = isTauri();

	onMount(() => {
		initTheme();
	});

	// Close the mobile drawer after navigating via sidebar links
	afterNavigate(() => {
		const drawer = document.getElementById('sidebar-drawer') as HTMLInputElement | null;
		if (drawer) drawer.checked = false;
	});
</script>

{#if showSidebar}
<div class="drawer lg:drawer-open">
	<input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<!-- Navbar for mobile -->
		<div class="navbar bg-base-200 pt-safe lg:hidden">
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
				<span class="text-xl font-bold">Moon Tapper</span>
			</div>
		</div>

		<!-- Page content -->
		<main class="flex-1 overflow-auto p-6">
			{@render children?.()}
		</main>
	</div>

	<div class="drawer-side">
		<label for="sidebar-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 min-h-full w-64 p-4 pt-safe">
			<div class="mb-6">
				<h2 class="text-xl font-bold">Moon Tapper</h2>
				<p class="text-sm opacity-60">Navigation</p>
			</div>

			<ul class="menu w-full">
				{#each routes as route}
					<li>
						<a
							href="{base}{route.path}"
							class:active={$page.url.pathname === base + route.path || (route.children && $page.url.pathname.startsWith(base + route.path + '/'))}
						>
							{route.name}
						</a>
						{#if route.children && $page.url.pathname.startsWith(base + route.path)}
							<ul>
								{#each route.children as child}
									<li>
										<a
											href="{base}{child.path}"
											class:active={$page.url.pathname === base + child.path}
										>
											{child.name}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		</aside>
	</div>
</div>
{:else}
<div class="min-h-screen flex flex-col">
	<Navbar />
	<main class="flex-1 p-6">
		{@render children?.()}
	</main>
</div>
{/if}
