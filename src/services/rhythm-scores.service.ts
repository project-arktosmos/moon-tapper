import { ArrayServiceClass } from '$services/classes/array-service.class';
import type { RhythmScore } from '$types/rhythm.type';

export const rhythmScoresService = new ArrayServiceClass<RhythmScore>('rhythm-scores', []);
