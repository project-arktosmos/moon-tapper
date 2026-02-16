import { db } from './db';
import type { LrcLibResponse } from '$types/lyrics.type';

interface LyricsCacheRow {
	cache_key: string;
	lrclib_id: number | null;
	track_name: string;
	artist_name: string;
	album_name: string;
	duration: number;
	instrumental: number;
	plain_lyrics: string | null;
	synced_lyrics: string | null;
	found: number;
}

export const lyricsCache = {
	async get(cacheKey: string): Promise<{ found: boolean; data: LrcLibResponse | null } | null> {
		const row = await db.queryOne<LyricsCacheRow>(
			'SELECT * FROM lyrics_cache WHERE cache_key = ?',
			[cacheKey]
		);
		if (!row) return null;

		if (row.found === 0) {
			return { found: false, data: null };
		}

		return {
			found: true,
			data: {
				id: row.lrclib_id ?? 0,
				trackName: row.track_name,
				artistName: row.artist_name,
				albumName: row.album_name,
				duration: row.duration,
				instrumental: !!row.instrumental,
				plainLyrics: row.plain_lyrics,
				syncedLyrics: row.synced_lyrics
			}
		};
	},

	async has(trackName: string, artistName: string | null): Promise<{ found: boolean; hasLyrics: boolean } | null> {
		const cacheKey = `${artistName ?? 'unknown'}:${trackName}`.toLowerCase();
		const row = await db.queryOne<{ found: number; synced_lyrics: string | null; plain_lyrics: string | null }>(
			'SELECT found, synced_lyrics, plain_lyrics FROM lyrics_cache WHERE cache_key = ?',
			[cacheKey]
		);
		if (!row) return null;
		return {
			found: row.found === 1,
			hasLyrics: !!(row.synced_lyrics || row.plain_lyrics)
		};
	},

	async save(cacheKey: string, data: LrcLibResponse): Promise<void> {
		await db.execute(
			`INSERT OR REPLACE INTO lyrics_cache
			 (cache_key, lrclib_id, track_name, artist_name, album_name,
			  duration, instrumental, plain_lyrics, synced_lyrics, found)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
			[
				cacheKey,
				data.id,
				data.trackName,
				data.artistName,
				data.albumName,
				data.duration,
				data.instrumental ? 1 : 0,
				data.plainLyrics,
				data.syncedLyrics
			]
		);
	},

	async saveNotFound(cacheKey: string, trackName: string, artistName: string): Promise<void> {
		await db.execute(
			`INSERT OR REPLACE INTO lyrics_cache
			 (cache_key, track_name, artist_name, found)
			 VALUES (?, ?, ?, 0)`,
			[cacheKey, trackName, artistName]
		);
	}
};
