import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { RhythmPlaylist } from '$types/rhythm.type';
import { FAVORITES_PLAYLIST_ID } from '$types/rhythm.type';

export const rhythmPlaylistsService = new ArrayServiceClass<RhythmPlaylist>(
	'rhythm-playlists',
	[]
);

// Ensure the default Favorites playlist always exists
if (!rhythmPlaylistsService.exists(FAVORITES_PLAYLIST_ID)) {
	const now = new Date().toISOString();
	rhythmPlaylistsService.add({
		id: FAVORITES_PLAYLIST_ID,
		name: 'Favorites',
		tracks: [],
		createdAt: now,
		updatedAt: now
	});
}
