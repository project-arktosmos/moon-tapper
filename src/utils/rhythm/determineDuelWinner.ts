import type { RhythmGameState, DuelWinner } from '$types/rhythm.type';

export function determineDuelWinner(
	player1: RhythmGameState,
	player2: RhythmGameState
): DuelWinner {
	if (player1.score > player2.score) return 'player1';
	if (player2.score > player1.score) return 'player2';
	if (player1.perfect > player2.perfect) return 'player1';
	if (player2.perfect > player1.perfect) return 'player2';
	return 'draw';
}
