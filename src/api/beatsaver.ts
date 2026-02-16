import { invoke } from '@tauri-apps/api/core';
import type { BeatSaverSearchResponse, BeatSaverMap, BeatSaverMapExtracted } from '$types/rhythm.type';
import { beatsaverCache } from './beatsaver-cache';

const API_BASE = 'https://api.beatsaver.com';

export const beatsaverApi = {
	async searchMaps(query: string, page: number = 0): Promise<BeatSaverSearchResponse> {
		const url = `${API_BASE}/search/text/${page}?q=${encodeURIComponent(query)}&sortOrder=Rating`;
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
