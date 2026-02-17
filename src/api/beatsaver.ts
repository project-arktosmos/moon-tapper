import { isTauri } from '$utils/isTauri';
import type {
	BeatSaverSearchResponse,
	BeatSaverMap,
	BeatSaverMapExtracted,
	BeatSaverSearchFilters
} from '$types/rhythm.type';
import { DEFAULT_SEARCH_FILTERS } from '$types/rhythm.type';

export interface TrackFetchResult {
	mapId: string;
	status: 'success' | 'already_cached' | 'error';
	error: string | null;
}

async function getInvoke() {
	if (!isTauri()) throw new Error('This feature requires the desktop app.');
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke;
}

export const beatsaverApi = {
	async searchMaps(
		query: string,
		page: number = 0,
		filters: BeatSaverSearchFilters = DEFAULT_SEARCH_FILTERS
	): Promise<BeatSaverSearchResponse> {
		const invoke = await getInvoke();
		return invoke<BeatSaverSearchResponse>('beatsaver_search', {
			query,
			page,
			filters
		});
	},

	async getLatestMaps(
		sort: 'CURATED' | 'LAST_PUBLISHED' | 'FIRST_PUBLISHED' | 'UPDATED' | 'CREATED' = 'CURATED',
		pageSize: number = 20
	): Promise<BeatSaverSearchResponse> {
		const invoke = await getInvoke();
		return invoke<BeatSaverSearchResponse>('beatsaver_browse', {
			sort,
			pageSize
		});
	},

	async getMapById(id: string): Promise<BeatSaverMap> {
		const invoke = await getInvoke();
		return invoke<BeatSaverMap>('beatsaver_get_map', { id });
	},

	async hasDownloadedMap(mapId: string): Promise<boolean> {
		const invoke = await getInvoke();
		return invoke<boolean>('beatsaver_has_download', { mapId });
	},

	async downloadTrack(mapId: string, downloadUrl: string): Promise<BeatSaverMapExtracted> {
		const invoke = await getInvoke();
		return invoke<BeatSaverMapExtracted>('beatsaver_download_track', {
			mapId,
			downloadUrl
		});
	},

	/** Enqueue a track for background download. Returns mapId for event correlation. */
	async fetchTrack(mapId: string, downloadUrl: string): Promise<string> {
		const invoke = await getInvoke();
		return invoke<string>('beatsaver_fetch_track', { mapId, downloadUrl });
	}
};
