<script lang="ts">
	import classNames from 'classnames';
	import { page } from '$app/stores';
	import routes from '$lib/routes.json';

	const topRoutes = routes.filter((r) => !r.children && r.path !== '/');
	const rhythmGroup = routes.find((r) => r.children);

	$: currentPath = $page.url.pathname;
	$: isUnderRhythm = currentPath.startsWith('/rhythm');
</script>

<nav class="navbar bg-base-200 sticky top-0 z-50">
	<!-- Mobile: hamburger -->
	<div class="navbar-start lg:hidden">
		<div class="dropdown">
			<div tabindex="0" role="button" class="btn btn-ghost btn-square">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</div>
			<ul
				tabindex="0"
				class="menu menu-sm dropdown-content bg-base-200 rounded-box mt-3 w-52 p-2 shadow z-50"
			>
				<li>
					<a href="/" class={classNames({ active: currentPath === '/' })}>Home</a>
				</li>
				{#each topRoutes as route}
					<li>
						<a
							href={route.path}
							class={classNames({ active: currentPath === route.path })}
						>
							{route.name}
						</a>
					</li>
				{/each}
				{#if rhythmGroup}
					<li>
						<span class={classNames({ active: isUnderRhythm })}>{rhythmGroup.name}</span>
						<ul>
							{#each rhythmGroup.children as child}
								<li>
									<a
										href={child.path}
										class={classNames({ active: currentPath === child.path })}
									>
										{child.name}
									</a>
								</li>
							{/each}
						</ul>
					</li>
				{/if}
			</ul>
		</div>
	</div>

	<!-- Brand -->
	<div class="navbar-center lg:navbar-start">
		<a href="/" class="btn btn-ghost text-xl font-bold normal-case">Moon Tapper</a>
	</div>

	<!-- Desktop: horizontal links -->
	<div class="navbar-end hidden lg:flex">
		<ul class="menu menu-horizontal gap-1">
			{#each topRoutes as route}
				<li>
					<a
						href={route.path}
						class={classNames({ active: currentPath === route.path })}
					>
						{route.name}
					</a>
				</li>
			{/each}
			{#if rhythmGroup}
				<li>
					<details>
						<summary class={classNames({ active: isUnderRhythm })}>
							{rhythmGroup.name}
						</summary>
						<ul class="bg-base-200 rounded-box p-2 z-50 w-48">
							{#each rhythmGroup.children as child}
								<li>
									<a
										href={child.path}
										class={classNames({
											active: currentPath === child.path
										})}
									>
										{child.name}
									</a>
								</li>
							{/each}
						</ul>
					</details>
				</li>
			{/if}
		</ul>
	</div>
</nav>
