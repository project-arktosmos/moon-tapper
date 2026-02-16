import { AdapterClass } from '$adapters/classes/adapter.class';
import type {
	BeatMap,
	BeatMapDifficultySet,
	BeatMapInfo,
	BeatMapNote,
	BeatMapObstacle,
	NoteType
} from '$types/rhythm.type';

interface V2Note {
	_time: number;
	_lineIndex: number;
	_lineLayer: number;
	_type: number;
	_cutDirection: number;
}

interface V2Obstacle {
	_time: number;
	_type: number;
	_duration: number;
	_lineIndex: number;
	_width: number;
}

interface V2BeatMap {
	_version: string;
	_notes: V2Note[];
	_obstacles: V2Obstacle[];
}

interface V3Note {
	b: number;
	x: number;
	y: number;
	c: number;
	d: number;
	a?: number;
}

interface V3BombNote {
	b: number;
	x: number;
	y: number;
}

interface V3Obstacle {
	b: number;
	x: number;
	y: number;
	d: number;
	w: number;
	h: number;
}

interface V3BeatMap {
	version: string;
	colorNotes: V3Note[];
	bombNotes: V3BombNote[];
	obstacles: V3Obstacle[];
}

function noteTypeFromInt(type: number): NoteType {
	if (type === 0) return 'left';
	if (type === 1) return 'right';
	return 'bomb';
}

export class BeatsaverAdapter extends AdapterClass {
	constructor() {
		super('beatsaver');
	}

	parseInfoDat(json: string): BeatMapInfo {
		const raw = JSON.parse(json);
		const sets: BeatMapDifficultySet[] = (
			raw._difficultyBeatmapSets || []
		).map(
			(set: {
				_beatmapCharacteristicName: string;
				_difficultyBeatmaps: {
					_difficulty: string;
					_difficultyRank: number;
					_beatmapFilename: string;
					_noteJumpMovementSpeed: number;
					_noteJumpStartBeatOffset: number;
				}[];
			}) => ({
				characteristicName: set._beatmapCharacteristicName,
				difficultyBeatmaps: (set._difficultyBeatmaps || []).map(
					(d: {
						_difficulty: string;
						_difficultyRank: number;
						_beatmapFilename: string;
						_noteJumpMovementSpeed: number;
						_noteJumpStartBeatOffset: number;
					}) => ({
						difficulty: d._difficulty,
						difficultyRank: d._difficultyRank,
						beatmapFilename: d._beatmapFilename,
						noteJumpMovementSpeed: d._noteJumpMovementSpeed,
						noteJumpStartBeatOffset: d._noteJumpStartBeatOffset
					})
				)
			})
		);

		return {
			songName: raw._songName || '',
			songSubName: raw._songSubName || '',
			songAuthorName: raw._songAuthorName || '',
			levelAuthorName: raw._levelAuthorName || '',
			bpm: raw._beatsPerMinute || 120,
			difficultyBeatmapSets: sets
		};
	}

	parseBeatMapV2(json: string, bpm: number): BeatMap {
		const raw: V2BeatMap = JSON.parse(json);
		const secPerBeat = 60 / bpm;

		const notes: BeatMapNote[] = (raw._notes || [])
			.map((n) => ({
				time: n._time * secPerBeat,
				column: Math.max(0, Math.min(3, n._lineIndex)),
				row: Math.max(0, Math.min(2, n._lineLayer)),
				type: noteTypeFromInt(n._type),
				direction: n._cutDirection
			}))
			.sort((a, b) => a.time - b.time);

		const obstacles: BeatMapObstacle[] = (raw._obstacles || [])
			.map((o) => ({
				time: o._time * secPerBeat,
				duration: o._duration * secPerBeat,
				column: o._lineIndex,
				width: o._width
			}))
			.sort((a, b) => a.time - b.time);

		return { notes, obstacles, bpm };
	}

	parseBeatMapV3(json: string, bpm: number): BeatMap {
		const raw: V3BeatMap = JSON.parse(json);
		const secPerBeat = 60 / bpm;

		const colorNotes: BeatMapNote[] = (raw.colorNotes || []).map((n) => ({
			time: n.b * secPerBeat,
			column: Math.max(0, Math.min(3, n.x)),
			row: Math.max(0, Math.min(2, n.y)),
			type: noteTypeFromInt(n.c),
			direction: n.d
		}));

		const bombNotes: BeatMapNote[] = (raw.bombNotes || []).map((n) => ({
			time: n.b * secPerBeat,
			column: Math.max(0, Math.min(3, n.x)),
			row: Math.max(0, Math.min(2, n.y)),
			type: 'bomb' as NoteType,
			direction: 8
		}));

		const notes = [...colorNotes, ...bombNotes].sort((a, b) => a.time - b.time);

		const obstacles: BeatMapObstacle[] = (raw.obstacles || [])
			.map((o) => ({
				time: o.b * secPerBeat,
				duration: o.d * secPerBeat,
				column: o.x,
				width: o.w
			}))
			.sort((a, b) => a.time - b.time);

		return { notes, obstacles, bpm };
	}

	parseBeatMap(json: string, bpm: number): BeatMap {
		const raw = JSON.parse(json);
		if (raw._version || raw._notes) {
			return this.parseBeatMapV2(json, bpm);
		}
		return this.parseBeatMapV3(json, bpm);
	}

	calculateGrade(perfect: number, good: number, miss: number): string {
		const total = perfect + good + miss;
		if (total === 0) return 'D';
		const accuracy = (perfect + good * 0.5) / total;
		if (accuracy >= 0.95) return 'S';
		if (accuracy >= 0.85) return 'A';
		if (accuracy >= 0.70) return 'B';
		if (accuracy >= 0.50) return 'C';
		return 'D';
	}
}

export const beatsaverAdapter = new BeatsaverAdapter();
