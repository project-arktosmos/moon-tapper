import { db } from './db';
import type {
	BeatSaverMap,
	BeatSaverMapVersion,
	BeatSaverDiff,
	BeatSaverMapExtracted
} from '$types/rhythm.type';

interface BsMapRow {
	id: string;
	name: string;
	description: string;
	bpm: number;
	duration: number;
	song_name: string;
	song_sub_name: string;
	song_author_name: string;
	level_author_name: string;
	plays: number;
	downloads: number;
	upvotes: number;
	downvotes: number;
	score: number;
	uploaded: string;
	automapper: number;
}

interface BsVersionRow {
	hash: string;
	map_id: string;
	key: string;
	state: string;
	download_url: string;
	cover_url: string;
	preview_url: string;
}

interface BsDiffRow {
	version_hash: string;
	njs: number;
	offset: number;
	notes: number;
	bombs: number;
	obstacles: number;
	nps: number;
	characteristic: string;
	difficulty: string;
}

interface BsBrowseRow {
	map_id: string;
}

interface BsDownloadRow {
	map_id: string;
	info_dat: string;
	beatmaps_json: string;
	audio_base64: string;
	cover_base64: string | null;
}

export const beatsaverCache = {
	async getMapById(id: string): Promise<BeatSaverMap | null> {
		const row = await db.queryOne<BsMapRow>('SELECT * FROM bs_maps WHERE id = ?', [id]);
		if (!row) return null;
		return this.assembleMap(row);
	},

	async getBrowseMaps(category: string): Promise<BeatSaverMap[] | null> {
		const result = await db.query<BsBrowseRow>(
			'SELECT map_id FROM bs_browse_entries WHERE category = ? ORDER BY sort_order ASC',
			[category]
		);
		if (result.rows.length === 0) return null;

		const maps: BeatSaverMap[] = [];
		for (const row of result.rows) {
			const map = await this.getMapById(row.map_id);
			if (map) maps.push(map);
		}
		return maps;
	},

	async getDownloadedMap(mapId: string): Promise<BeatSaverMapExtracted | null> {
		const row = await db.queryOne<BsDownloadRow>(
			'SELECT * FROM bs_map_downloads WHERE map_id = ?',
			[mapId]
		);
		if (!row) return null;
		return {
			info_dat: row.info_dat,
			beatmaps: JSON.parse(row.beatmaps_json),
			audio_base64: row.audio_base64,
			cover_base64: row.cover_base64
		};
	},

	async saveMap(map: BeatSaverMap): Promise<void> {
		await db.execute(
			`INSERT OR REPLACE INTO bs_maps
			 (id, name, description, bpm, duration, song_name, song_sub_name,
			  song_author_name, level_author_name, plays, downloads, upvotes,
			  downvotes, score, uploaded, automapper)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				map.id,
				map.name,
				map.description,
				map.metadata.bpm,
				map.metadata.duration,
				map.metadata.songName,
				map.metadata.songSubName,
				map.metadata.songAuthorName,
				map.metadata.levelAuthorName,
				map.stats.plays,
				map.stats.downloads,
				map.stats.upvotes,
				map.stats.downvotes,
				map.stats.score,
				map.uploaded,
				map.automapper ? 1 : 0
			]
		);

		// Delete old versions (cascade deletes diffs)
		await db.execute('DELETE FROM bs_map_versions WHERE map_id = ?', [map.id]);

		for (const version of map.versions || []) {
			await db.execute(
				`INSERT OR REPLACE INTO bs_map_versions
				 (hash, map_id, key, state, download_url, cover_url, preview_url)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					version.hash,
					map.id,
					version.key,
					version.state,
					version.downloadURL,
					version.coverURL,
					version.previewURL
				]
			);

			for (const diff of version.diffs || []) {
				await db.execute(
					`INSERT INTO bs_map_diffs
					 (version_hash, njs, 'offset', notes, bombs, obstacles, nps, characteristic, difficulty)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						version.hash,
						diff.njs,
						diff.offset,
						diff.notes,
						diff.bombs,
						diff.obstacles,
						diff.nps,
						diff.characteristic,
						diff.difficulty
					]
				);
			}
		}
	},

	async saveMaps(maps: BeatSaverMap[]): Promise<void> {
		for (const map of maps) {
			await this.saveMap(map);
		}
	},

	async saveBrowseCategory(category: string, maps: BeatSaverMap[]): Promise<void> {
		await this.saveMaps(maps);
		await db.execute('DELETE FROM bs_browse_entries WHERE category = ?', [category]);
		for (let i = 0; i < maps.length; i++) {
			await db.execute(
				'INSERT INTO bs_browse_entries (category, map_id, sort_order) VALUES (?, ?, ?)',
				[category, maps[i].id, i]
			);
		}
	},

	async hasDownloadedMap(mapId: string): Promise<boolean> {
		const row = await db.queryOne<{ map_id: string }>(
			'SELECT map_id FROM bs_map_downloads WHERE map_id = ?',
			[mapId]
		);
		return row !== null;
	},

	async saveDownloadedMap(mapId: string, data: BeatSaverMapExtracted): Promise<void> {
		await db.execute(
			`INSERT OR REPLACE INTO bs_map_downloads
			 (map_id, info_dat, beatmaps_json, audio_base64, cover_base64)
			 VALUES (?, ?, ?, ?, ?)`,
			[mapId, data.info_dat, JSON.stringify(data.beatmaps), data.audio_base64, data.cover_base64]
		);
	},

	async assembleMap(row: BsMapRow): Promise<BeatSaverMap> {
		const versionsResult = await db.query<BsVersionRow>(
			'SELECT * FROM bs_map_versions WHERE map_id = ?',
			[row.id]
		);

		const versions: BeatSaverMapVersion[] = [];
		for (const vRow of versionsResult.rows) {
			const diffsResult = await db.query<BsDiffRow>(
				'SELECT * FROM bs_map_diffs WHERE version_hash = ?',
				[vRow.hash]
			);
			versions.push({
				hash: vRow.hash,
				key: vRow.key,
				state: vRow.state,
				downloadURL: vRow.download_url,
				coverURL: vRow.cover_url,
				previewURL: vRow.preview_url,
				diffs: diffsResult.rows.map((d) => ({
					njs: d.njs,
					offset: d.offset,
					notes: d.notes,
					bombs: d.bombs,
					obstacles: d.obstacles,
					nps: d.nps,
					characteristic: d.characteristic,
					difficulty: d.difficulty
				}))
			});
		}

		return {
			id: row.id,
			name: row.name,
			description: row.description,
			metadata: {
				bpm: row.bpm,
				duration: row.duration,
				songName: row.song_name,
				songSubName: row.song_sub_name,
				songAuthorName: row.song_author_name,
				levelAuthorName: row.level_author_name
			},
			stats: {
				plays: row.plays,
				downloads: row.downloads,
				upvotes: row.upvotes,
				downvotes: row.downvotes,
				score: row.score
			},
			uploaded: row.uploaded,
			automapper: !!row.automapper,
			versions
		};
	}
};
