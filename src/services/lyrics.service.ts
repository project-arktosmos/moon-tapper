import { writable, get, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { LrcLibResponse, Lyrics, LyricsState, SyncedLyricLine } from '$types/lyrics.type';
import { lyricsCache } from '$api/lyrics-cache';

const LRCLIB_API_BASE = 'https://lrclib.net/api';
const USER_AGENT = 'PokemonCardioCompanion/1.0.0 (https://github.com/arktosmos)';

class LyricsService {
	store: Writable<LyricsState>;
	private cache: Map<string, Lyrics> = new Map();

	constructor() {
		this.store = writable<LyricsState>({
			status: 'idle',
			lyrics: null,
			error: null
		});
	}

	async fetchLyrics(
		trackName: string,
		artistName: string | null,
		albumName?: string | null,
		duration?: number
	): Promise<void> {
		if (!browser) return;

		const cacheKey = this.getCacheKey(trackName, artistName);

		// L1: in-memory cache
		const memCached = this.cache.get(cacheKey);
		if (memCached) {
			this.store.set({ status: 'success', lyrics: memCached, error: null });
			return;
		}

		// L2: SQLite cache
		try {
			const dbCached = await lyricsCache.get(cacheKey);
			if (dbCached !== null) {
				if (!dbCached.found) {
					this.store.set({ status: 'not_found', lyrics: null, error: null });
					return;
				}
				if (dbCached.data) {
					const lyrics = this.parseResponse(dbCached.data);
					this.cache.set(cacheKey, lyrics);
					this.store.set({ status: 'success', lyrics, error: null });
					return;
				}
			}
		} catch (e) {
			console.error('Lyrics DB cache error:', e);
		}

		// L3: API fetch
		this.store.update((s) => ({ ...s, status: 'loading', error: null }));

		try {
			const params = new URLSearchParams();
			params.set('track_name', trackName);
			if (artistName) params.set('artist_name', artistName);
			if (albumName) params.set('album_name', albumName);
			if (duration && duration > 0) params.set('duration', Math.round(duration).toString());

			const response = await fetch(`${LRCLIB_API_BASE}/get?${params.toString()}`, {
				headers: { 'Lrclib-Client': USER_AGENT }
			});

			if (response.status === 404) {
				lyricsCache.saveNotFound(cacheKey, trackName, artistName ?? 'unknown').catch(console.error);
				this.store.set({ status: 'not_found', lyrics: null, error: null });
				return;
			}

			if (!response.ok) {
				throw new Error(`LRCLIB API error: ${response.status}`);
			}

			const data: LrcLibResponse = await response.json();
			const lyrics = this.parseResponse(data);

			lyricsCache.save(cacheKey, data).catch(console.error);
			this.cache.set(cacheKey, lyrics);
			this.store.set({ status: 'success', lyrics, error: null });
		} catch (error) {
			this.store.set({
				status: 'error',
				lyrics: null,
				error: error instanceof Error ? error.message : 'Failed to fetch lyrics'
			});
		}
	}

	clear(): void {
		this.store.set({ status: 'idle', lyrics: null, error: null });
	}

	getCurrentLineIndex(currentTime: number): number {
		const state = get(this.store);
		if (!state.lyrics?.syncedLyrics) return -1;

		const lines = state.lyrics.syncedLyrics;
		let currentIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].time <= currentTime) {
				currentIndex = i;
			} else {
				break;
			}
		}

		return currentIndex;
	}

	private parseResponse(data: LrcLibResponse): Lyrics {
		return {
			id: data.id,
			trackName: data.trackName,
			artistName: data.artistName,
			albumName: data.albumName,
			duration: data.duration,
			instrumental: data.instrumental,
			plainLyrics: data.plainLyrics,
			syncedLyrics: data.syncedLyrics ? this.parseSyncedLyrics(data.syncedLyrics) : null
		};
	}

	private parseSyncedLyrics(lrc: string): SyncedLyricLine[] {
		const lines: SyncedLyricLine[] = [];
		const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
		let match;

		while ((match = regex.exec(lrc)) !== null) {
			const minutes = parseInt(match[1], 10);
			const seconds = parseInt(match[2], 10);
			const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
			const text = match[4].trim();

			const time = minutes * 60 + seconds + milliseconds / 1000;
			lines.push({ time, text });
		}

		lines.sort((a, b) => a.time - b.time);
		return lines;
	}

	private getCacheKey(trackName: string, artistName: string | null): string {
		return `${artistName ?? 'unknown'}:${trackName}`.toLowerCase();
	}
}

export const lyricsService = new LyricsService();
