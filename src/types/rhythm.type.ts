import type { ID } from '$types/core.type';

// --- BeatSaver search filter types ---

export type BeatSaverSortOrder = 'Latest' | 'Relevance' | 'Rating' | 'Curated' | 'Random' | 'Duration';

export type BeatSaverLeaderboard = 'All' | 'Ranked' | 'BeatLeader' | 'ScoreSaber';

export type BeatSaverTag =
	| 'tech'
	| 'dance-style'
	| 'speed'
	| 'balanced'
	| 'challenge'
	| 'accuracy'
	| 'fitness'
	| 'nightcore'
	| 'folk-acoustic'
	| 'kids-family'
	| 'ambient'
	| 'funk-disco'
	| 'jazz'
	| 'classical-orchestral'
	| 'soul'
	| 'speedcore'
	| 'punk'
	| 'rb'
	| 'vocaloid'
	| 'j-rock'
	| 'trance'
	| 'drum-and-bass'
	| 'comedy-meme'
	| 'instrumental'
	| 'hardcore'
	| 'k-pop'
	| 'indie'
	| 'techno'
	| 'house'
	| 'video-game-soundtrack'
	| 'tv-movie-soundtrack'
	| 'alternative'
	| 'dubstep'
	| 'metal'
	| 'anime'
	| 'hip-hop-rap'
	| 'j-pop'
	| 'dance'
	| 'rock'
	| 'pop'
	| 'electronic';

export interface BeatSaverSearchFilters {
	sortOrder: BeatSaverSortOrder;
	tags: BeatSaverTag[];
	excludeTags: BeatSaverTag[];
	minBpm: number | null;
	maxBpm: number | null;
	minNps: number | null;
	maxNps: number | null;
	minDuration: number | null;
	maxDuration: number | null;
	minRating: number | null;
	maxRating: number | null;
	curated: boolean | null;
	verified: boolean | null;
	automapper: boolean | null;
	from: string | null;
	to: string | null;
	leaderboard: BeatSaverLeaderboard | null;
	pageSize: number;
}

export const DEFAULT_SEARCH_FILTERS: BeatSaverSearchFilters = {
	sortOrder: 'Rating',
	tags: [],
	excludeTags: [],
	minBpm: null,
	maxBpm: null,
	minNps: null,
	maxNps: null,
	minDuration: null,
	maxDuration: null,
	minRating: null,
	maxRating: null,
	curated: null,
	verified: null,
	automapper: null,
	from: null,
	to: null,
	leaderboard: null,
	pageSize: 20
};

// --- BeatSaver API types ---

export interface BeatSaverSearchPaginationInfo {
	total: number;
	pages: number;
	duration: number;
}

export interface BeatSaverSearchResponse {
	docs: BeatSaverMap[];
	info?: BeatSaverSearchPaginationInfo;
}

export interface BeatSaverMap {
	id: string;
	name: string;
	description: string;
	metadata: BeatSaverMetadata;
	stats: BeatSaverStats;
	uploaded: string;
	automapper: boolean;
	versions: BeatSaverMapVersion[];
}

export interface BeatSaverMetadata {
	bpm: number;
	duration: number;
	songName: string;
	songSubName: string;
	songAuthorName: string;
	levelAuthorName: string;
}

export interface BeatSaverStats {
	plays: number;
	downloads: number;
	upvotes: number;
	downvotes: number;
	score: number;
}

export interface BeatSaverMapVersion {
	hash: string;
	key: string;
	state: string;
	downloadURL: string;
	coverURL: string;
	previewURL: string;
	diffs: BeatSaverDiff[];
}

export interface BeatSaverDiff {
	njs: number;
	offset: number;
	notes: number;
	bombs: number;
	obstacles: number;
	nps: number;
	characteristic: string;
	difficulty: string;
}

// --- Extracted map data from Tauri backend ---

export interface BeatSaverMapExtracted {
	info_dat: string;
	beatmaps: Record<string, string>;
	audio_base64: string;
	cover_base64: string | null;
}

// --- Parsed beat map types ---

export interface BeatMapInfo {
	songName: string;
	songSubName: string;
	songAuthorName: string;
	levelAuthorName: string;
	bpm: number;
	difficultyBeatmapSets: BeatMapDifficultySet[];
}

export interface BeatMapDifficultySet {
	characteristicName: string;
	difficultyBeatmaps: BeatMapDifficultyEntry[];
}

export interface BeatMapDifficultyEntry {
	difficulty: string;
	difficultyRank: number;
	beatmapFilename: string;
	noteJumpMovementSpeed: number;
	noteJumpStartBeatOffset: number;
}

export type NoteType = 'left' | 'right' | 'bomb';

export interface BeatMapNote {
	time: number;
	column: number;
	row: number;
	type: NoteType;
	direction: number;
}

export interface BeatMapObstacle {
	time: number;
	duration: number;
	column: number;
	width: number;
}

export interface BeatMap {
	notes: BeatMapNote[];
	obstacles: BeatMapObstacle[];
	bpm: number;
}

// --- Game state types ---

export interface GameNote extends BeatMapNote {
	id: number;
	hit: boolean;
	missed: boolean;
	score: number;
}

export interface RhythmGameState {
	score: number;
	combo: number;
	maxCombo: number;
	perfect: number;
	good: number;
	miss: number;
	health: number;
}

export const DEFAULT_RHYTHM_GAME_STATE: RhythmGameState = {
	score: 0,
	combo: 0,
	maxCombo: 0,
	perfect: 0,
	good: 0,
	miss: 0,
	health: 100
};

// --- Settings ---

export interface LaneBinding {
	keyboard: string;
	gamepad: string | null;
}

export type LaneModeBindings = Record<2 | 3 | 4, Record<number, LaneBinding>>;

export const DEFAULT_LANE_MODE_BINDINGS: LaneModeBindings = {
	2: {
		0: { keyboard: 'KeyF', gamepad: null },
		1: { keyboard: 'KeyJ', gamepad: null }
	},
	3: {
		0: { keyboard: 'KeyF', gamepad: null },
		1: { keyboard: 'Space', gamepad: null },
		2: { keyboard: 'KeyJ', gamepad: null }
	},
	4: {
		0: { keyboard: 'KeyD', gamepad: null },
		1: { keyboard: 'KeyF', gamepad: null },
		2: { keyboard: 'KeyJ', gamepad: null },
		3: { keyboard: 'KeyK', gamepad: null }
	}
};

export const DEFAULT_DUEL_LANE_MODE_BINDINGS: DuelLaneModeBindings = {
	player1: structuredClone(DEFAULT_LANE_MODE_BINDINGS),
	player2: {
		2: {
			0: { keyboard: 'KeyE', gamepad: null },
			1: { keyboard: 'KeyI', gamepad: null }
		},
		3: {
			0: { keyboard: 'KeyE', gamepad: null },
			1: { keyboard: 'KeyG', gamepad: null },
			2: { keyboard: 'KeyI', gamepad: null }
		},
		4: {
			0: { keyboard: 'KeyW', gamepad: null },
			1: { keyboard: 'KeyE', gamepad: null },
			2: { keyboard: 'KeyI', gamepad: null },
			3: { keyboard: 'KeyO', gamepad: null }
		}
	}
};

export interface DuelLaneModeBindings {
	player1: LaneModeBindings;
	player2: LaneModeBindings;
}

export interface RhythmSettings {
	id: ID;
	scrollSpeed: number;
	volume: number;
	keyBindings: Record<number, string>;
	laneModeBindings: LaneModeBindings;
	duelLaneModeBindings: DuelLaneModeBindings;
	offset: number;
}

export const DEFAULT_RHYTHM_SETTINGS: RhythmSettings = {
	id: 'rhythm-settings',
	scrollSpeed: 1.0,
	volume: 0.8,
	keyBindings: { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' },
	laneModeBindings: structuredClone(DEFAULT_LANE_MODE_BINDINGS),
	duelLaneModeBindings: structuredClone(DEFAULT_DUEL_LANE_MODE_BINDINGS),
	offset: 0
};

// --- Scores ---

export interface RhythmScore {
	id: ID;
	mapId: string;
	mapName: string;
	difficulty: string;
	score: number;
	maxCombo: number;
	perfect: number;
	good: number;
	miss: number;
	grade: string;
	date: string;
}

// --- Lane mode ---

export type LaneMode = 2 | 3 | 4;
export const DEFAULT_LANE_MODE: LaneMode = 3;

// --- Game session state ---

export type GameSessionState = 'loading' | 'ready' | 'playing' | 'results';

// --- Playlist types ---

export interface PlaylistTrackDiff {
	difficulty: string;
	characteristic: string;
}

export interface PlaylistTrack {
	id: string;
	songName: string;
	songAuthorName: string;
	levelAuthorName: string;
	bpm: number;
	duration: number;
	coverURL: string;
	diffs: PlaylistTrackDiff[];
	addedAt: string;
}

export interface RhythmPlaylist {
	id: string;
	name: string;
	tracks: PlaylistTrack[];
	createdAt: string;
	updatedAt: string;
}

export const FAVORITES_PLAYLIST_ID = 'favorites';

// --- Game mode ---

export type GameMode = 'single' | 'duel';
export const DEFAULT_GAME_MODE: GameMode = 'single';

export type DuelWinner = 'player1' | 'player2' | 'draw';

// --- Playlist import/export ---

export interface RhythmPlaylistExport {
	version: 1;
	name: string;
	tracks: PlaylistTrack[];
}
