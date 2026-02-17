import { isTauri } from '$utils/isTauri';
import { unzipSync } from 'fflate';
import type {
	BeatSaverSearchResponse,
	BeatSaverMap,
	BeatSaverMapExtracted,
	BeatSaverSearchFilters
} from '$types/rhythm.type';
import { DEFAULT_SEARCH_FILTERS } from '$types/rhythm.type';
import {
	beatsaverMapsCacheService,
	beatsaverBrowseCacheService
} from '$services/beatsaver-cache.service';

export interface TrackFetchResult {
	mapId: string;
	status: 'success' | 'already_cached' | 'error';
	error: string | null;
}

const API_BASE = 'https://api.beatsaver.com';

async function getInvoke() {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke;
}

function buildSearchParams(query: string, filters: BeatSaverSearchFilters): string {
	const params = new URLSearchParams();

	if (query.trim()) params.set('q', query.trim());
	params.set('sortOrder', filters.sortOrder);

	const tagParts: string[] = [
		...filters.tags,
		...filters.excludeTags.map((t) => `!${t}`)
	];
	if (tagParts.length > 0) params.set('tags', tagParts.join(','));

	if (filters.minBpm !== null) params.set('minBpm', String(filters.minBpm));
	if (filters.maxBpm !== null) params.set('maxBpm', String(filters.maxBpm));
	if (filters.minNps !== null) params.set('minNps', String(filters.minNps));
	if (filters.maxNps !== null) params.set('maxNps', String(filters.maxNps));
	if (filters.minDuration !== null) params.set('minDuration', String(filters.minDuration));
	if (filters.maxDuration !== null) params.set('maxDuration', String(filters.maxDuration));
	if (filters.minRating !== null) params.set('minRating', String(filters.minRating));
	if (filters.maxRating !== null) params.set('maxRating', String(filters.maxRating));
	if (filters.curated !== null) params.set('curated', String(filters.curated));
	if (filters.verified !== null) params.set('verified', String(filters.verified));
	if (filters.automapper !== null) params.set('automapper', String(filters.automapper));
	if (filters.from) params.set('from', filters.from);
	if (filters.to) params.set('to', filters.to);
	if (filters.leaderboard) params.set('leaderboard', filters.leaderboard);
	if (filters.pageSize !== 20) params.set('pageSize', String(filters.pageSize));

	return params.toString();
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function extractMapZip(zipBytes: Uint8Array): BeatSaverMapExtracted {
	const files = unzipSync(zipBytes);

	let info_dat = '';
	const beatmaps: Record<string, string> = {};
	let audio_base64 = '';
	let cover_base64: string | null = null;

	const decoder = new TextDecoder();

	for (const [path, data] of Object.entries(files)) {
		const name = path.toLowerCase();
		if (name === 'info.dat') {
			info_dat = decoder.decode(data);
		} else if (name.endsWith('.dat')) {
			beatmaps[path] = decoder.decode(data);
		} else if (name.endsWith('.ogg') || name.endsWith('.egg')) {
			audio_base64 = bytesToBase64(data);
		} else if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')) {
			cover_base64 = bytesToBase64(data);
		}
	}

	if (!info_dat) throw new Error('No Info.dat found in ZIP');
	if (!audio_base64) throw new Error('No audio file found in ZIP');

	return { info_dat, beatmaps, audio_base64, cover_base64 };
}

/** Cache a map in localStorage (add or update) */
function cacheMap(map: BeatSaverMap): void {
	if (beatsaverMapsCacheService.exists(map.id)) {
		beatsaverMapsCacheService.update(map);
	} else {
		beatsaverMapsCacheService.add(map);
	}
}

/** Cache multiple maps from a search/browse response */
function cacheMaps(maps: BeatSaverMap[]): void {
	for (const map of maps) {
		cacheMap(map);
	}
}

export const beatsaverApi = {
	async searchMaps(
		query: string,
		page: number = 0,
		filters: BeatSaverSearchFilters = DEFAULT_SEARCH_FILTERS
	): Promise<BeatSaverSearchResponse> {
		let result: BeatSaverSearchResponse;
		if (isTauri()) {
			const invoke = await getInvoke();
			result = await invoke<BeatSaverSearchResponse>('beatsaver_search', {
				query,
				page,
				filters
			});
		} else {
			const qs = buildSearchParams(query, filters);
			const res = await fetch(`${API_BASE}/search/text/${page}?${qs}`);
			if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
			result = await res.json();
		}
		cacheMaps(result.docs);
		return result;
	},

	async getLatestMaps(
		sort: 'CURATED' | 'LAST_PUBLISHED' | 'FIRST_PUBLISHED' | 'UPDATED' | 'CREATED' = 'CURATED',
		pageSize: number = 20
	): Promise<BeatSaverSearchResponse> {
		// Check browse cache
		const browseCache = beatsaverBrowseCacheService.get();
		const cachedIds = browseCache.categories[sort];
		if (cachedIds && cachedIds.length > 0) {
			const maps: BeatSaverMap[] = [];
			for (const id of cachedIds) {
				const cached = beatsaverMapsCacheService.exists(id);
				if (cached) maps.push(cached);
			}
			if (maps.length === cachedIds.length) {
				return { docs: maps };
			}
		}

		// Cache miss — fetch from API
		let result: BeatSaverSearchResponse;
		if (isTauri()) {
			const invoke = await getInvoke();
			result = await invoke<BeatSaverSearchResponse>('beatsaver_browse', {
				sort,
				pageSize
			});
		} else {
			const res = await fetch(
				`${API_BASE}/maps/latest?sort=${sort}&automapper=false&pageSize=${pageSize}`
			);
			if (!res.ok) throw new Error(`Browse failed: HTTP ${res.status}`);
			result = await res.json();
		}

		// Cache maps and browse category ordering
		cacheMaps(result.docs);
		beatsaverBrowseCacheService.set({
			...browseCache,
			categories: {
				...browseCache.categories,
				[sort]: result.docs.map((m) => m.id)
			}
		});

		return result;
	},

	async getMapById(id: string): Promise<BeatSaverMap> {
		// Check cache first
		const cached = beatsaverMapsCacheService.exists(id);
		if (cached) return cached;

		// Cache miss — fetch from API
		let map: BeatSaverMap;
		if (isTauri()) {
			const invoke = await getInvoke();
			map = await invoke<BeatSaverMap>('beatsaver_get_map', { id });
		} else {
			const res = await fetch(`${API_BASE}/maps/id/${encodeURIComponent(id)}`);
			if (!res.ok) throw new Error(`Map fetch failed: HTTP ${res.status}`);
			map = await res.json();
		}

		cacheMap(map);
		return map;
	},

	async hasDownloadedMap(mapId: string): Promise<boolean> {
		if (!isTauri()) return false;
		const invoke = await getInvoke();
		return invoke<boolean>('beatsaver_has_download', { mapId });
	},

	async downloadTrack(mapId: string, downloadUrl: string): Promise<BeatSaverMapExtracted> {
		if (isTauri()) {
			const invoke = await getInvoke();
			return invoke<BeatSaverMapExtracted>('beatsaver_download_track', {
				mapId,
				downloadUrl
			});
		}
		const res = await fetch(downloadUrl);
		if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
		const buffer = await res.arrayBuffer();
		return extractMapZip(new Uint8Array(buffer));
	},

	/** Enqueue a track for background download. Returns mapId for event correlation. */
	async fetchTrack(mapId: string, downloadUrl: string): Promise<string> {
		if (!isTauri()) throw new Error('Background download requires the desktop app.');
		const invoke = await getInvoke();
		return invoke<string>('beatsaver_fetch_track', { mapId, downloadUrl });
	}
};
