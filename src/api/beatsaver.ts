import { invoke } from '@tauri-apps/api/core';
import type {
	BeatSaverSearchResponse,
	BeatSaverMap,
	BeatSaverMapExtracted,
	BeatSaverSearchFilters
} from '$types/rhythm.type';
import { DEFAULT_SEARCH_FILTERS } from '$types/rhythm.type';
import { beatsaverCache } from './beatsaver-cache';

const API_BASE = 'https://api.beatsaver.com';

function buildSearchParams(query: string, filters: BeatSaverSearchFilters): string {
	const params = new URLSearchParams();

	if (query.trim()) {
		params.set('q', query.trim());
	}

	params.set('sortOrder', filters.sortOrder);

	const tagParts: string[] = [
		...filters.tags,
		...filters.excludeTags.map((t) => `!${t}`)
	];
	if (tagParts.length > 0) {
		params.set('tags', tagParts.join(','));
	}

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

export const beatsaverApi = {
	async searchMaps(
		query: string,
		page: number = 0,
		filters: BeatSaverSearchFilters = DEFAULT_SEARCH_FILTERS
	): Promise<BeatSaverSearchResponse> {
		const queryString = buildSearchParams(query, filters);
		const url = `${API_BASE}/search/text/${page}?${queryString}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);
		const result: BeatSaverSearchResponse = await response.json();

		// Cache individual maps in background for future lookups
		beatsaverCache.saveMaps(result.docs || []).catch(console.error);

		return result;
	},

	async getLatestMaps(
		sort: 'CURATED' | 'LAST_PUBLISHED' | 'FIRST_PUBLISHED' | 'UPDATED' | 'CREATED' = 'CURATED',
		pageSize: number = 20
	): Promise<BeatSaverSearchResponse> {
		// Try cache first
		try {
			const cached = await beatsaverCache.getBrowseMaps(sort);
			if (cached && cached.length > 0) {
				return { docs: cached };
			}
		} catch (e) {
			console.error('Browse cache read error:', e);
		}

		// Fallback to API
		const url = `${API_BASE}/maps/latest?sort=${sort}&automapper=false&pageSize=${pageSize}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Latest maps failed: HTTP ${response.status}`);
		const result: BeatSaverSearchResponse = await response.json();

		// Cache browse category in background
		beatsaverCache.saveBrowseCategory(sort, result.docs || []).catch(console.error);

		return result;
	},

	async getMapById(id: string): Promise<BeatSaverMap> {
		// Try cache first
		try {
			const cached = await beatsaverCache.getMapById(id);
			if (cached) return cached;
		} catch (e) {
			console.error('Map cache read error:', e);
		}

		// Fallback to API
		const url = `${API_BASE}/maps/id/${encodeURIComponent(id)}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Map fetch failed: HTTP ${response.status}`);
		const map: BeatSaverMap = await response.json();

		beatsaverCache.saveMap(map).catch(console.error);

		return map;
	},

	async downloadMap(downloadUrl: string, mapId?: string): Promise<BeatSaverMapExtracted> {
		// Try cache first if mapId provided
		if (mapId) {
			try {
				const cached = await beatsaverCache.getDownloadedMap(mapId);
				if (cached) return cached;
			} catch (e) {
				console.error('Download cache read error:', e);
			}
		}

		const data = await invoke<BeatSaverMapExtracted>('beatsaver_download', {
			url: downloadUrl
		});

		// Cache in background if mapId provided
		if (mapId) {
			beatsaverCache.saveDownloadedMap(mapId, data).catch(console.error);
		}

		return data;
	}
};
