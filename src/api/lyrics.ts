import { isTauri } from '$utils/isTauri';
import type { LrcLibResponse } from '$types/lyrics.type';

export interface LyricsCacheEntry {
	found: boolean;
	data: LrcLibResponse | null;
}

export interface LyricsCacheStatus {
	found: boolean;
	hasLyrics: boolean;
}

export interface LyricsFetchResult {
	cacheKey: string;
	status: 'success' | 'not_found' | 'error';
	data: LrcLibResponse | null;
	error: string | null;
}

export const lyricsApi = {
	/** Fast synchronous cache lookup (no queueing) */
	async cacheCheck(
		trackName: string,
		artistName: string | null
	): Promise<LyricsCacheEntry | null> {
		if (!isTauri()) return null;
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke<LyricsCacheEntry | null>('lyrics_cache_check', {
			trackName,
			artistName
		});
	},

	/** Lightweight cache check for badge display */
	async cacheHas(
		trackName: string,
		artistName: string | null
	): Promise<LyricsCacheStatus | null> {
		if (!isTauri()) return null;
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke<LyricsCacheStatus | null>('lyrics_cache_has', {
			trackName,
			artistName
		});
	},

	/** Enqueue a fetch request. Returns the cache_key for event correlation. */
	async fetch(
		trackName: string,
		artistName: string | null,
		albumName?: string | null,
		duration?: number
	): Promise<string> {
		if (!isTauri()) throw new Error('Lyrics require the desktop app.');
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke<string>('lyrics_fetch', {
			trackName,
			artistName,
			albumName: albumName ?? null,
			duration: duration ?? null
		});
	}
};
