import { writable, get, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { isTauri } from '$utils/isTauri';
import type { LrcLibResponse, Lyrics, LyricsState, SyncedLyricLine } from '$types/lyrics.type';
import { lyricsApi, type LyricsFetchResult } from '$api/lyrics';

class LyricsService {
	store: Writable<LyricsState>;
	private cache: Map<string, Lyrics> = new Map();
	private pendingCacheKey: string | null = null;
	private pendingResolve: (() => void) | null = null;

	constructor() {
		this.store = writable<LyricsState>({
			status: 'idle',
			lyrics: null,
			error: null
		});

		if (browser && isTauri()) {
			this.setupEventListener();
		}
	}

	private async setupEventListener(): Promise<void> {
		const { listen } = await import('@tauri-apps/api/event');
		await listen<LyricsFetchResult>('lyrics:fetch-result', (event) => {
			const result = event.payload;

			// Only process if this matches the current pending request
			if (result.cacheKey !== this.pendingCacheKey) return;

			this.pendingCacheKey = null;
			this.handleFetchResult(result);

			// Resolve the pending promise so .finally() fires on the caller
			if (this.pendingResolve) {
				this.pendingResolve();
				this.pendingResolve = null;
			}
		});
	}

	private handleFetchResult(result: LyricsFetchResult): void {
		if (result.status === 'not_found') {
			this.store.set({ status: 'not_found', lyrics: null, error: null });
			return;
		}

		if (result.status === 'error') {
			this.store.set({
				status: 'error',
				lyrics: null,
				error: result.error ?? 'Failed to fetch lyrics'
			});
			return;
		}

		if (result.status === 'success' && result.data) {
			const lyrics = this.parseResponse(result.data);
			this.cache.set(result.cacheKey, lyrics);
			this.store.set({ status: 'success', lyrics, error: null });
		}
	}

	async fetchLyrics(
		trackName: string,
		artistName: string | null,
		albumName?: string | null,
		duration?: number
	): Promise<void> {
		if (!browser) return;
		if (!isTauri()) {
			this.store.set({ status: 'error', lyrics: null, error: 'Lyrics require the desktop app.' });
			return;
		}

		const cacheKey = this.getCacheKey(trackName, artistName);

		// L1: in-memory cache
		const memCached = this.cache.get(cacheKey);
		if (memCached) {
			this.store.set({ status: 'success', lyrics: memCached, error: null });
			return;
		}

		// L2: SQLite cache (via Rust command)
		try {
			const dbCached = await lyricsApi.cacheCheck(trackName, artistName);
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

		// L3: Enqueue fetch to Rust backend and wait for event
		this.store.update((s) => ({ ...s, status: 'loading', error: null }));
		this.pendingCacheKey = cacheKey;

		try {
			await lyricsApi.fetch(trackName, artistName, albumName, duration);
			// Wait for the background worker result via event
			await new Promise<void>((resolve) => {
				this.pendingResolve = resolve;
			});
		} catch (error) {
			this.pendingCacheKey = null;
			this.pendingResolve = null;
			this.store.set({
				status: 'error',
				lyrics: null,
				error: error instanceof Error ? error.message : 'Failed to enqueue lyrics fetch'
			});
		}
	}

	clear(): void {
		// If there's a pending fetch, resolve it so the caller doesn't hang
		if (this.pendingResolve) {
			this.pendingResolve();
			this.pendingResolve = null;
		}
		this.pendingCacheKey = null;
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
