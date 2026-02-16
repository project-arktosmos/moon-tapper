import { invoke } from '@tauri-apps/api/core';

/** Result from a SELECT query */
export interface QueryResult<T = Record<string, unknown>> {
	columns: string[];
	rows: T[];
}

/** Result from an INSERT/UPDATE/DELETE operation */
export interface ExecuteResult {
	rows_affected: number;
	last_insert_id: number | null;
}

/** Raw query result before transformation */
interface RawQueryResult {
	columns: string[];
	rows: unknown[][];
}

/**
 * Database API - Generic query executor
 *
 * TypeScript assembles and types queries, Rust only executes them.
 * This minimizes Rust changes when adding new database operations.
 *
 * Usage:
 *   import { db } from '$api/db';
 *
 *   // SELECT query with typed result
 *   const users = await db.query<User>('SELECT * FROM users WHERE active = ?', [true]);
 *
 *   // INSERT with last insert ID
 *   const result = await db.execute('INSERT INTO users (name) VALUES (?)', ['John']);
 *   console.log(result.last_insert_id);
 *
 *   // UPDATE/DELETE with rows affected
 *   const deleted = await db.execute('DELETE FROM users WHERE id = ?', [1]);
 *   console.log(deleted.rows_affected);
 */
export const db = {
	/**
	 * Execute a SELECT query and return typed results
	 * Transforms raw row arrays into typed objects using column names
	 */
	async query<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = []
	): Promise<QueryResult<T>> {
		const result = await invoke<RawQueryResult>('db_query', { sql, params });

		// Transform array rows to objects using column names
		const rows = result.rows.map((row) => {
			const obj: Record<string, unknown> = {};
			result.columns.forEach((col, i) => {
				obj[col] = row[i];
			});
			return obj as T;
		});

		return {
			columns: result.columns,
			rows
		};
	},

	/**
	 * Execute a single row SELECT query
	 * Returns the first row or null if no results
	 */
	async queryOne<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = []
	): Promise<T | null> {
		const result = await this.query<T>(sql, params);
		return result.rows[0] ?? null;
	},

	/**
	 * Execute an INSERT/UPDATE/DELETE statement
	 * Returns rows affected and last insert ID (for INSERTs)
	 */
	async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
		return invoke<ExecuteResult>('db_execute', { sql, params });
	}
};

// Re-export types for convenience
export type { QueryResult as DbQueryResult, ExecuteResult as DbExecuteResult };
