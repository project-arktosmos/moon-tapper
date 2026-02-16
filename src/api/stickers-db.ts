import { db } from './db';
import type { StickerManifest } from '$types/sticker.type';

export const stickersDbApi = {
	/** Check if stickers have already been seeded */
	async isSeeded(): Promise<boolean> {
		const result = await db.queryOne<{ count: number }>(
			'SELECT COUNT(*) as count FROM sticker_collections'
		);
		return (result?.count ?? 0) > 0;
	},

	/** Seed the database from the JSON manifest. Idempotent — skips if already seeded. */
	async seedFromManifest(manifest: StickerManifest): Promise<void> {
		if (await this.isSeeded()) return;

		for (const collection of manifest.collections) {
			await db.execute(
				'INSERT INTO sticker_collections (id, name, base_path) VALUES (?, ?, ?)',
				[collection.id, collection.name, collection.basePath]
			);

			for (const category of collection.categories) {
				const catResult = await db.execute(
					'INSERT INTO sticker_categories (collection_id, slug, name, path) VALUES (?, ?, ?, ?)',
					[collection.id, category.id, category.name, category.path ?? null]
				);
				const categoryId = catResult.last_insert_id!;

				if (category.subcategories?.length) {
					for (const sub of category.subcategories) {
						const subResult = await db.execute(
							'INSERT INTO sticker_subcategories (category_id, slug, name, path) VALUES (?, ?, ?, ?)',
							[categoryId, sub.id, sub.name, sub.path]
						);
						const subcategoryId = subResult.last_insert_id!;

						if (sub.sprites.length) {
							await this._batchInsertSprites(
								collection.id,
								categoryId,
								subcategoryId,
								sub.sprites
							);
						}
					}
				} else if (category.sprites?.length) {
					await this._batchInsertSprites(
						collection.id,
						categoryId,
						null,
						category.sprites
					);
				}
			}

			if (collection.characters.length) {
				await this._batchInsertCharacters(collection.id, collection.characters);
			}
		}
	},

	/** Batch insert sprites using multi-row INSERT (~200 per batch to stay within SQLite param limits) */
	async _batchInsertSprites(
		collectionId: string,
		categoryId: number,
		subcategoryId: number | null,
		filenames: string[]
	): Promise<void> {
		const BATCH_SIZE = 200;
		for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
			const batch = filenames.slice(i, i + BATCH_SIZE);
			const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
			const params: unknown[] = [];
			for (const filename of batch) {
				params.push(collectionId, categoryId, subcategoryId, filename);
			}
			await db.execute(
				`INSERT INTO sticker_sprites (collection_id, category_id, subcategory_id, filename) VALUES ${placeholders}`,
				params
			);
		}
	},

	/** Batch insert characters using multi-row INSERT */
	async _batchInsertCharacters(
		collectionId: string,
		characters: { name: string; path: string; thumbnail: string }[]
	): Promise<void> {
		const BATCH_SIZE = 200;
		for (let i = 0; i < characters.length; i += BATCH_SIZE) {
			const batch = characters.slice(i, i + BATCH_SIZE);
			const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
			const params: unknown[] = [];
			for (const char of batch) {
				params.push(collectionId, char.name, char.path, char.thumbnail);
			}
			await db.execute(
				`INSERT INTO sticker_characters (collection_id, name, path, thumbnail) VALUES ${placeholders}`,
				params
			);
		}
	},

	async getCollections() {
		const result = await db.query<{ id: string; name: string; base_path: string }>(
			'SELECT id, name, base_path FROM sticker_collections ORDER BY id'
		);
		return result.rows;
	},

	async getCategories(collectionId: string) {
		const result = await db.query<{
			id: number;
			slug: string;
			name: string;
			path: string | null;
		}>(
			'SELECT id, slug, name, path FROM sticker_categories WHERE collection_id = ? ORDER BY id',
			[collectionId]
		);
		return result.rows;
	},

	async getSubcategories(categoryId: number) {
		const result = await db.query<{ id: number; slug: string; name: string; path: string }>(
			'SELECT id, slug, name, path FROM sticker_subcategories WHERE category_id = ? ORDER BY id',
			[categoryId]
		);
		return result.rows;
	},

	async getSprites(collectionId: string, categoryId?: number, subcategoryId?: number) {
		let sql = 'SELECT id, filename FROM sticker_sprites WHERE collection_id = ?';
		const params: unknown[] = [collectionId];
		if (categoryId != null) {
			sql += ' AND category_id = ?';
			params.push(categoryId);
		}
		if (subcategoryId != null) {
			sql += ' AND subcategory_id = ?';
			params.push(subcategoryId);
		}
		sql += ' ORDER BY id';
		const result = await db.query<{ id: number; filename: string }>(sql, params);
		return result.rows;
	},

	async getCharacters(collectionId: string) {
		const result = await db.query<{
			id: number;
			name: string;
			path: string;
			thumbnail: string;
		}>(
			'SELECT id, name, path, thumbnail FROM sticker_characters WHERE collection_id = ? ORDER BY id',
			[collectionId]
		);
		return result.rows;
	}
};
