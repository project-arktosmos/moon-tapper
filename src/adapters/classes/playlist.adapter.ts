import { AdapterClass } from '$adapters/classes/adapter.class';
import type { BeatSaverMap, PlaylistTrack, PlaylistTrackDiff } from '$types/rhythm.type';

export class PlaylistAdapter extends AdapterClass {
	constructor() {
		super('playlist');
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
