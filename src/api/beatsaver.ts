import { invoke } from '@tauri-apps/api/core';
import type { BeatSaverSearchResponse, BeatSaverMap, BeatSaverMapExtracted } from '$types/rhythm.type';

const API_BASE = 'https://api.beatsaver.com';

export const beatsaverApi = {
	async searchMaps(query: string, page: number = 0): Promise<BeatSaverSearchResponse> {
		const url = `${API_BASE}/search/text/${page}?q=${encodeURIComponent(query)}&sortOrder=Rating`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);
		return response.json();
	},

	async getLatestMaps(
		sort: 'CURATED' | 'LAST_PUBLISHED' | 'FIRST_PUBLISHED' | 'UPDATED' | 'CREATED' = 'CURATED',
		pageSize: number = 20
	): Promise<BeatSaverSearchResponse> {
		const url = `${API_BASE}/maps/latest?sort=${sort}&automapper=false&pageSize=${pageSize}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Latest maps failed: HTTP ${response.status}`);
		return response.json();
	},

	async getMapById(id: string): Promise<BeatSaverMap> {
		const url = `${API_BASE}/maps/id/${encodeURIComponent(id)}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Map fetch failed: HTTP ${response.status}`);
		return response.json();
	},

	async downloadMap(downloadUrl: string): Promise<BeatSaverMapExtracted> {
		return invoke<BeatSaverMapExtracted>('beatsaver_download', { url: downloadUrl });
	}
};
