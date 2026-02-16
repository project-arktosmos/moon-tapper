export interface LrcLibResponse {
	id: number;
	trackName: string;
	artistName: string;
	albumName: string;
	duration: number;
	instrumental: boolean;
	plainLyrics: string | null;
	syncedLyrics: string | null;
}

export interface SyncedLyricLine {
	time: number;
	text: string;
}

export interface Lyrics {
	id: number;
	trackName: string;
	artistName: string;
	albumName: string;
	duration: number;
	instrumental: boolean;
	plainLyrics: string | null;
	syncedLyrics: SyncedLyricLine[] | null;
}

export type LyricsFetchStatus = 'idle' | 'loading' | 'success' | 'not_found' | 'error';

export interface LyricsState {
	status: LyricsFetchStatus;
	lyrics: Lyrics | null;
	error: string | null;
}
