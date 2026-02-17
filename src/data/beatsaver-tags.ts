import type { BeatSaverTag } from '$types/rhythm.type';

export interface TagGroup {
	key: string;
	label: string;
	tags: BeatSaverTag[];
}

export const TAG_LABELS: Record<string, string> = {
	'tech': 'Tech',
	'dance-style': 'Dance Style',
	'speed': 'Speed',
	'balanced': 'Balanced',
	'challenge': 'Challenge',
	'accuracy': 'Accuracy',
	'fitness': 'Fitness',
	'nightcore': 'Nightcore',
	'folk-acoustic': 'Folk / Acoustic',
	'kids-family': 'Kids / Family',
	'ambient': 'Ambient',
	'funk-disco': 'Funk / Disco',
	'jazz': 'Jazz',
	'classical-orchestral': 'Classical / Orchestral',
	'soul': 'Soul',
	'speedcore': 'Speedcore',
	'punk': 'Punk',
	'rb': 'R&B',
	'vocaloid': 'Vocaloid',
	'j-rock': 'J-Rock',
	'trance': 'Trance',
	'drum-and-bass': 'Drum & Bass',
	'comedy-meme': 'Comedy / Meme',
	'instrumental': 'Instrumental',
	'hardcore': 'Hardcore',
	'k-pop': 'K-Pop',
	'indie': 'Indie',
	'techno': 'Techno',
	'house': 'House',
	'video-game-soundtrack': 'Video Game OST',
	'tv-movie-soundtrack': 'TV / Movie OST',
	'alternative': 'Alternative',
	'dubstep': 'Dubstep',
	'metal': 'Metal',
	'anime': 'Anime',
	'hip-hop-rap': 'Hip-Hop / Rap',
	'j-pop': 'J-Pop',
	'dance': 'Dance',
	'rock': 'Rock',
	'pop': 'Pop',
	'electronic': 'Electronic'
};

export const BEATSAVER_TAG_GROUPS: TagGroup[] = [
	{
		key: 'genres',
		label: 'Genres',
		tags: [
			'pop',
			'rock',
			'electronic',
			'metal',
			'hip-hop-rap',
			'dance',
			'alternative',
			'indie',
			'punk',
			'rb',
			'soul',
			'jazz',
			'classical-orchestral',
			'folk-acoustic',
			'ambient'
		]
	},
	{
		key: 'subgenres',
		label: 'Subgenres',
		tags: [
			'house',
			'techno',
			'trance',
			'drum-and-bass',
			'dubstep',
			'hardcore',
			'speedcore',
			'nightcore',
			'funk-disco'
		]
	},
	{
		key: 'culture',
		label: 'Cultural / Regional',
		tags: ['j-pop', 'j-rock', 'k-pop', 'anime', 'vocaloid']
	},
	{
		key: 'media',
		label: 'Media & Themes',
		tags: ['video-game-soundtrack', 'tv-movie-soundtrack', 'comedy-meme', 'kids-family', 'instrumental']
	},
	{
		key: 'mapStyle',
		label: 'Map Style',
		tags: ['tech', 'dance-style', 'speed', 'balanced', 'challenge', 'accuracy', 'fitness']
	}
];
