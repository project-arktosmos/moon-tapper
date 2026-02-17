import { ArrayServiceClass } from '$services/classes/array-service.class';
import { ObjectServiceClass } from '$services/classes/object-service.class';
import type { BeatSaverMap } from '$types/rhythm.type';

// Cache of BeatSaver map metadata (with nested versions/diffs)
export const beatsaverMapsCacheService = new ArrayServiceClass<BeatSaverMap>(
	'beatsaver-maps-cache',
	[]
);

// Browse category cache: maps category name → ordered list of map IDs
interface BeatSaverBrowseCache {
	id: string;
	categories: Record<string, string[]>;
}

export const beatsaverBrowseCacheService = new ObjectServiceClass<BeatSaverBrowseCache>(
	'beatsaver-browse-cache',
	{ id: 'browse-cache', categories: {} }
);
