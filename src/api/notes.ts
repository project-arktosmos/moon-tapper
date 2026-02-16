import { db } from './db';
import type { Note, CreateNoteInput, UpdateNoteInput } from './types';

/**
 * Notes API - Example CRUD operations using the generic database interface
 *
 * This demonstrates how to build typed APIs on top of the generic db.query/db.execute.
 * TypeScript handles query composition and typing, Rust just executes.
 *
 * Usage:
 *   import { notesApi } from '$api/notes';
 *
 *   const notes = await notesApi.getAll();
 *   const note = await notesApi.create({ title: 'Hello', content: 'World' });
 */
export const notesApi = {
	async getAll(): Promise<Note[]> {
		const result = await db.query<Note>(
			'SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC'
		);
		return result.rows;
	},

	async get(id: number): Promise<Note | null> {
		return db.queryOne<Note>(
			'SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?',
			[id]
		);
	},

	async create(input: CreateNoteInput): Promise<Note> {
		const result = await db.execute('INSERT INTO notes (title, content) VALUES (?, ?)', [
			input.title,
			input.content
		]);

		const note = await this.get(result.last_insert_id!);
		if (!note) throw new Error('Failed to create note');
		return note;
	},

	async update(input: UpdateNoteInput): Promise<Note> {
		await db.execute(
			"UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
			[input.title, input.content, input.id]
		);

		const note = await this.get(input.id);
		if (!note) throw new Error('Note not found');
		return note;
	},

	async delete(id: number): Promise<boolean> {
		const result = await db.execute('DELETE FROM notes WHERE id = ?', [id]);
		return result.rows_affected > 0;
	}
};
