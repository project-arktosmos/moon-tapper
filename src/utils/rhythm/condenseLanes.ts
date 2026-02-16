import type { BeatMap } from '$types/rhythm.type';

const COLUMN_TO_LANE_3: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: 2 };

export function condenseTo3Lanes(beatMap: BeatMap): BeatMap {
	return {
		...beatMap,
		notes: beatMap.notes.map((note) => ({
			...note,
			column: COLUMN_TO_LANE_3[note.column] ?? 1
		})),
		obstacles: beatMap.obstacles.map((obs) => ({
			...obs,
			column: COLUMN_TO_LANE_3[obs.column] ?? 1,
			width: Math.min(obs.width, 1)
		}))
	};
}
