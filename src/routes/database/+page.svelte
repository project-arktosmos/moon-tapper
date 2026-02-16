<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$api/db';

	interface TableInfo {
		name: string;
		sql: string;
		columns: ColumnInfo[];
	}

	interface ColumnInfo {
		cid: number;
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}

	interface SqliteMasterRow {
		type: string;
		name: string;
		tbl_name: string;
		sql: string;
	}

	let tables: TableInfo[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expandedTable = $state<string | null>(null);

	onMount(async () => {
		await loadSchema();
	});

	async function loadSchema() {
		loading = true;
		error = null;

		try {
			// Query sqlite_master for all tables (excluding internal sqlite_ tables)
			const result = await db.query<SqliteMasterRow>(
				"SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
			);

			// For each table, get its column info using PRAGMA
			const tableInfos: TableInfo[] = [];
			for (const row of result.rows) {
				const columnsResult = await db.query<ColumnInfo>(`PRAGMA table_info("${row.name}")`);
				tableInfos.push({
					name: row.name,
					sql: row.sql,
					columns: columnsResult.rows
				});
			}

			tables = tableInfos;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function toggleTable(name: string) {
		expandedTable = expandedTable === name ? null : name;
	}

	function formatType(type: string): string {
		return type || 'ANY';
	}
</script>

<div class="max-w-4xl">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Database</h1>
		<button class="btn btn-ghost btn-sm" onclick={loadSchema} disabled={loading}>
			{#if loading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh
			{/if}
		</button>
	</div>

	{#if error}
		<div role="alert" class="alert alert-error mb-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if tables.length === 0}
		<div class="card bg-base-200">
			<div class="card-body items-center text-center">
				<h2 class="card-title opacity-60">No Tables Found</h2>
				<p class="opacity-50">The database is empty or has no user-created tables.</p>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			{#each tables as table (table.name)}
				<div class="card bg-base-200">
					<div class="card-body p-0">
						<button
							class="flex w-full items-center justify-between p-4 text-left hover:bg-base-300 transition-colors rounded-t-2xl"
							onclick={() => toggleTable(table.name)}
						>
							<div class="flex items-center gap-3">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5 opacity-60"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
									/>
								</svg>
								<span class="font-mono font-semibold">{table.name}</span>
								<span class="badge badge-ghost badge-sm">{table.columns.length} columns</span>
							</div>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 transition-transform {expandedTable === table.name
									? 'rotate-180'
									: ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>

						{#if expandedTable === table.name}
							<div class="border-t border-base-300">
								<div class="overflow-x-auto">
									<table class="table table-sm">
										<thead>
											<tr>
												<th>Column</th>
												<th>Type</th>
												<th>Nullable</th>
												<th>Default</th>
												<th>Primary Key</th>
											</tr>
										</thead>
										<tbody>
											{#each table.columns as col (col.cid)}
												<tr>
													<td class="font-mono">{col.name}</td>
													<td>
														<span class="badge badge-outline badge-sm"
															>{formatType(col.type)}</span
														>
													</td>
													<td>
														{#if col.notnull}
															<span class="text-error">NOT NULL</span>
														{:else}
															<span class="opacity-50">nullable</span>
														{/if}
													</td>
													<td>
														{#if col.dflt_value}
															<code class="text-xs bg-base-300 px-1 rounded"
																>{col.dflt_value}</code
															>
														{:else}
															<span class="opacity-30">-</span>
														{/if}
													</td>
													<td>
														{#if col.pk}
															<span class="badge badge-primary badge-sm">PK</span>
														{:else}
															<span class="opacity-30">-</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="border-t border-base-300 p-4">
									<details class="collapse collapse-arrow bg-base-300 rounded-lg">
										<summary class="collapse-title text-sm font-medium py-2 min-h-0">
											View CREATE statement
										</summary>
										<div class="collapse-content">
											<pre
												class="text-xs overflow-x-auto bg-base-100 p-3 rounded mt-2"><code
													>{table.sql}</code
												></pre>
										</div>
									</details>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-6 text-center text-sm opacity-50">
			{tables.length} table{tables.length !== 1 ? 's' : ''} in database
		</div>
	{/if}
</div>
