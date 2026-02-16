import type { ID } from '$types/core.type';

// --- BeatSaver API types ---

export interface BeatSaverSearchResponse {
	docs: BeatSaverMap[];
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

export interface RhythmSettings {
	id: ID;
	scrollSpeed: number;
	volume: number;
	keyBindings: Record<number, string>;
	offset: number;
}

export const DEFAULT_RHYTHM_SETTINGS: RhythmSettings = {
	id: 'rhythm-settings',
	scrollSpeed: 1.0,
	volume: 0.8,
	keyBindings: { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' },
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

// --- Playlist import/export ---

export interface RhythmPlaylistExport {
	version: 1;
	name: string;
	tracks: PlaylistTrack[];
}
