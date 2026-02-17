import { AdapterClass } from '$adapters/classes/adapter.class';
import type { BeatMap, BeatMapNote, NoteType } from '$types/rhythm.type';

export class BeatGeneratorAdapter extends AdapterClass {
	private patternSeed = 0;

	constructor() {
		super('beat-generator');
	}

	private seededRandom(): number {
		this.patternSeed = (this.patternSeed * 1103515245 + 12345) & 0x7fffffff;
		return this.patternSeed / 0x7fffffff;
	}

	private generateNotePattern(beatNumber: number, laneCount: number): number[] {
		this.patternSeed = beatNumber * 12345;

		const lanes: number[] = [];
		const halfLanes = Math.floor(laneCount / 2);

		const isDownbeat = beatNumber % 4 === 0;
		const isHalfBeat = beatNumber % 2 === 0;

		if (isDownbeat) {
			const noteCount = this.seededRandom() > 0.7 ? 2 : 1;
			for (let i = 0; i < noteCount; i++) {
				const lane = Math.floor(this.seededRandom() * halfLanes);
				if (!lanes.includes(lane)) lanes.push(lane);
			}
		} else if (isHalfBeat) {
			const noteCount = this.seededRandom() > 0.7 ? 2 : 1;
			for (let i = 0; i < noteCount; i++) {
				const lane = Math.floor(this.seededRandom() * laneCount);
				if (!lanes.includes(lane)) lanes.push(lane);
			}
		} else {
			if (this.seededRandom() > 0.4) {
				lanes.push(Math.floor(this.seededRandom() * halfLanes) + halfLanes);
			}
		}

		return lanes;
	}

	generateBeatMap(durationSeconds: number, bpm: number, offsetMs: number): BeatMap {
		const beatInterval = (60 / bpm) * 1000;
		const offsetSec = offsetMs / 1000;
		const durationMs = durationSeconds * 1000;
		const totalBeats = Math.floor((durationMs - offsetMs) / beatInterval);

		const notes: BeatMapNote[] = [];
		const laneCount = 4;

		for (let beat = 0; beat <= totalBeats; beat++) {
			const beatTimeMs = offsetMs + beat * beatInterval;
			if (beatTimeMs < 0 || beatTimeMs > durationMs) continue;

			const beatTimeSec = beatTimeMs / 1000;
			const lanes = this.generateNotePattern(beat, laneCount);

			for (const lane of lanes) {
				const type: NoteType = lane < laneCount / 2 ? 'left' : 'right';
				notes.push({
					time: beatTimeSec,
					column: lane,
					row: 0,
					type,
					direction: 0
				});
			}
		}

		return { notes, obstacles: [], bpm };
	}
}

export const beatGeneratorAdapter = new BeatGeneratorAdapter();
