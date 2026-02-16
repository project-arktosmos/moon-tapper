import { AdapterClass } from '$adapters/classes/adapter.class';
import type { BeatSaverMap, PlaylistTrack, PlaylistTrackDiff, RhythmPlaylist, RhythmPlaylistExport } from '$types/rhythm.type';

export class PlaylistAdapter extends AdapterClass {
	constructor() {
		super('playlist');
	}

	toExportJSON(playlist: RhythmPlaylist): RhythmPlaylistExport {
		return {
			version: 1,
			name: playlist.name,
			tracks: playlist.tracks
		};
	}

	fromExportJSON(json: unknown): RhythmPlaylist {
		if (!json || typeof json !== 'object') throw new Error('Invalid playlist file');
		const data = json as Record<string, unknown>;
		if (data.version !== 1) throw new Error('Unsupported playlist version');
		if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('Missing playlist name');
		if (!Array.isArray(data.tracks)) throw new Error('Missing tracks array');

		for (const track of data.tracks) {
			if (!track || typeof track !== 'object') throw new Error('Invalid track entry');
			if (typeof track.id !== 'string') throw new Error('Track missing id');
			if (typeof track.songName !== 'string') throw new Error('Track missing songName');
		}

		const now = new Date().toISOString();
		return {
			id: crypto.randomUUID(),
			name: data.name,
			tracks: data.tracks as PlaylistTrack[],
			createdAt: now,
			updatedAt: now
		};
	}

	fromBeatSaverMap(map: BeatSaverMap): PlaylistTrack {
		const version = map.versions?.[0];
		const diffs: PlaylistTrackDiff[] = (version?.diffs || []).map((d) => ({
			difficulty: d.difficulty,
			characteristic: d.characteristic
		}));

		return {
			id: map.id,
			songName: map.metadata.songName,
			songAuthorName: map.metadata.songAuthorName,
			levelAuthorName: map.metadata.levelAuthorName,
			bpm: map.metadata.bpm,
			duration: map.metadata.duration,
			coverURL: version?.coverURL || '',
			diffs,
			addedAt: new Date().toISOString()
		};
	}
}

export const playlistAdapter = new PlaylistAdapter();
