use crate::db::Database;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

// ---------------------------------------------------------------------------
// BeatSaver API response types (matching their JSON exactly)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverSearchResponse {
    pub docs: Vec<BeatSaverMap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info: Option<BeatSaverPaginationInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverPaginationInfo {
    pub total: i64,
    pub pages: i64,
    #[serde(default)]
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverMap {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub metadata: BeatSaverMetadata,
    pub stats: BeatSaverStats,
    #[serde(default)]
    pub uploaded: String,
    #[serde(default)]
    pub automapper: bool,
    #[serde(default)]
    pub versions: Vec<BeatSaverMapVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverMetadata {
    #[serde(default)]
    pub bpm: f64,
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub song_name: String,
    #[serde(default)]
    pub song_sub_name: String,
    #[serde(default)]
    pub song_author_name: String,
    #[serde(default)]
    pub level_author_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverStats {
    #[serde(default)]
    pub plays: i64,
    #[serde(default)]
    pub downloads: i64,
    #[serde(default)]
    pub upvotes: i64,
    #[serde(default)]
    pub downvotes: i64,
    #[serde(default)]
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverMapVersion {
    pub hash: String,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub state: String,
    #[serde(rename = "downloadURL", default)]
    pub download_url: String,
    #[serde(rename = "coverURL", default)]
    pub cover_url: String,
    #[serde(rename = "previewURL", default)]
    pub preview_url: String,
    #[serde(default)]
    pub diffs: Vec<BeatSaverDiff>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverDiff {
    #[serde(default)]
    pub njs: f64,
    #[serde(default)]
    pub offset: f64,
    #[serde(default)]
    pub notes: i64,
    #[serde(default)]
    pub bombs: i64,
    #[serde(default)]
    pub obstacles: i64,
    #[serde(default)]
    pub nps: f64,
    #[serde(default)]
    pub characteristic: String,
    #[serde(default)]
    pub difficulty: String,
}

// ---------------------------------------------------------------------------
// Search filters (mirrors TypeScript BeatSaverSearchFilters)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSaverSearchFilters {
    pub sort_order: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub exclude_tags: Vec<String>,
    pub min_bpm: Option<f64>,
    pub max_bpm: Option<f64>,
    pub min_nps: Option<f64>,
    pub max_nps: Option<f64>,
    pub min_duration: Option<f64>,
    pub max_duration: Option<f64>,
    pub min_rating: Option<f64>,
    pub max_rating: Option<f64>,
    pub curated: Option<bool>,
    pub verified: Option<bool>,
    pub automapper: Option<bool>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub leaderboard: Option<String>,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page_size() -> i64 {
    20
}

// ---------------------------------------------------------------------------
// Extracted map data (existing struct, now with Clone + Deserialize)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeatSaverMapData {
    pub info_dat: String,
    pub beatmaps: HashMap<String, String>,
    pub audio_base64: String,
    pub cover_base64: Option<String>,
}

// ---------------------------------------------------------------------------
// Queue types (follows LyricsQueue pattern)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct TrackFetchRequest {
    pub map_id: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackFetchResult {
    pub map_id: String,
    pub status: String, // "success" | "already_cached" | "error"
    pub error: Option<String>,
}

pub struct TrackQueue {
    pub tx: mpsc::UnboundedSender<TrackFetchRequest>,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE: &str = "https://api.beatsaver.com";

// ---------------------------------------------------------------------------
// URL param builder for search
// ---------------------------------------------------------------------------

fn build_search_params(query: &str, page: i64, filters: &BeatSaverSearchFilters) -> String {
    let mut params: Vec<(String, String)> = Vec::new();

    let trimmed = query.trim();
    if !trimmed.is_empty() {
        params.push(("q".to_string(), trimmed.to_string()));
    }

    params.push(("sortOrder".to_string(), filters.sort_order.clone()));

    let mut tag_parts: Vec<String> = filters.tags.clone();
    for t in &filters.exclude_tags {
        tag_parts.push(format!("!{}", t));
    }
    if !tag_parts.is_empty() {
        params.push(("tags".to_string(), tag_parts.join(",")));
    }

    if let Some(v) = filters.min_bpm { params.push(("minBpm".to_string(), v.to_string())); }
    if let Some(v) = filters.max_bpm { params.push(("maxBpm".to_string(), v.to_string())); }
    if let Some(v) = filters.min_nps { params.push(("minNps".to_string(), v.to_string())); }
    if let Some(v) = filters.max_nps { params.push(("maxNps".to_string(), v.to_string())); }
    if let Some(v) = filters.min_duration { params.push(("minDuration".to_string(), v.to_string())); }
    if let Some(v) = filters.max_duration { params.push(("maxDuration".to_string(), v.to_string())); }
    if let Some(v) = filters.min_rating { params.push(("minRating".to_string(), v.to_string())); }
    if let Some(v) = filters.max_rating { params.push(("maxRating".to_string(), v.to_string())); }
    if let Some(v) = filters.curated { params.push(("curated".to_string(), v.to_string())); }
    if let Some(v) = filters.verified { params.push(("verified".to_string(), v.to_string())); }
    if let Some(v) = filters.automapper { params.push(("automapper".to_string(), v.to_string())); }
    if let Some(ref v) = filters.from { if !v.is_empty() { params.push(("from".to_string(), v.clone())); } }
    if let Some(ref v) = filters.to { if !v.is_empty() { params.push(("to".to_string(), v.clone())); } }
    if let Some(ref v) = filters.leaderboard { if !v.is_empty() { params.push(("leaderboard".to_string(), v.clone())); } }
    if filters.page_size != 20 { params.push(("pageSize".to_string(), filters.page_size.to_string())); }

    let qs: Vec<String> = params
        .iter()
        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
        .collect();

    format!("{}/search/text/{}?{}", API_BASE, page, qs.join("&"))
}

// ---------------------------------------------------------------------------
// DB cache helpers
// ---------------------------------------------------------------------------

fn save_map_to_cache(db: &Database, map: &BeatSaverMap) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO bs_maps
         (id, name, description, bpm, duration, song_name, song_sub_name,
          song_author_name, level_author_name, plays, downloads, upvotes,
          downvotes, score, uploaded, automapper)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
        params![
            map.id,
            map.name,
            map.description,
            map.metadata.bpm,
            map.metadata.duration,
            map.metadata.song_name,
            map.metadata.song_sub_name,
            map.metadata.song_author_name,
            map.metadata.level_author_name,
            map.stats.plays,
            map.stats.downloads,
            map.stats.upvotes,
            map.stats.downvotes,
            map.stats.score,
            map.uploaded,
            map.automapper as i32,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Delete old versions (cascade handles diffs)
    conn.execute("DELETE FROM bs_map_versions WHERE map_id = ?1", params![map.id])
        .map_err(|e| e.to_string())?;

    for version in &map.versions {
        conn.execute(
            "INSERT OR REPLACE INTO bs_map_versions
             (hash, map_id, key, state, download_url, cover_url, preview_url)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                version.hash,
                map.id,
                version.key,
                version.state,
                version.download_url,
                version.cover_url,
                version.preview_url,
            ],
        )
        .map_err(|e| e.to_string())?;

        for diff in &version.diffs {
            conn.execute(
                "INSERT INTO bs_map_diffs
                 (version_hash, njs, \"offset\", notes, bombs, obstacles, nps, characteristic, difficulty)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                params![
                    version.hash,
                    diff.njs,
                    diff.offset,
                    diff.notes,
                    diff.bombs,
                    diff.obstacles,
                    diff.nps,
                    diff.characteristic,
                    diff.difficulty,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn load_map_from_cache(db: &Database, map_id: &str) -> Result<Option<BeatSaverMap>, String> {
    let conn = db.conn.lock().unwrap();

    let map_row = conn
        .query_row(
            "SELECT id, name, description, bpm, duration, song_name, song_sub_name,
                    song_author_name, level_author_name, plays, downloads, upvotes,
                    downvotes, score, uploaded, automapper
             FROM bs_maps WHERE id = ?1",
            params![map_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, i64>(9)?,
                    row.get::<_, i64>(10)?,
                    row.get::<_, i64>(11)?,
                    row.get::<_, i64>(12)?,
                    row.get::<_, f64>(13)?,
                    row.get::<_, String>(14)?,
                    row.get::<_, i32>(15)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (id, name, description, bpm, duration, song_name, song_sub_name, song_author_name,
         level_author_name, plays, downloads, upvotes, downvotes, score, uploaded, automapper) =
        match map_row {
            Some(r) => r,
            None => return Ok(None),
        };

    // Load versions
    let mut version_stmt = conn
        .prepare(
            "SELECT hash, key, state, download_url, cover_url, preview_url
             FROM bs_map_versions WHERE map_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let version_rows: Vec<(String, String, String, String, String, String)> = version_stmt
        .query_map(params![map_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut versions: Vec<BeatSaverMapVersion> = Vec::new();
    for (hash, key, state, download_url, cover_url, preview_url) in &version_rows {
        let mut diff_stmt = conn
            .prepare(
                "SELECT njs, \"offset\", notes, bombs, obstacles, nps, characteristic, difficulty
                 FROM bs_map_diffs WHERE version_hash = ?1",
            )
            .map_err(|e| e.to_string())?;

        let diffs: Vec<BeatSaverDiff> = diff_stmt
            .query_map(params![hash], |row| {
                Ok(BeatSaverDiff {
                    njs: row.get(0)?,
                    offset: row.get(1)?,
                    notes: row.get(2)?,
                    bombs: row.get(3)?,
                    obstacles: row.get(4)?,
                    nps: row.get(5)?,
                    characteristic: row.get(6)?,
                    difficulty: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        versions.push(BeatSaverMapVersion {
            hash: hash.clone(),
            key: key.clone(),
            state: state.clone(),
            download_url: download_url.clone(),
            cover_url: cover_url.clone(),
            preview_url: preview_url.clone(),
            diffs,
        });
    }

    Ok(Some(BeatSaverMap {
        id,
        name,
        description,
        metadata: BeatSaverMetadata {
            bpm,
            duration,
            song_name,
            song_sub_name,
            song_author_name,
            level_author_name,
        },
        stats: BeatSaverStats {
            plays,
            downloads,
            upvotes,
            downvotes,
            score,
        },
        uploaded,
        automapper: automapper != 0,
        versions,
    }))
}

fn save_browse_to_cache(db: &Database, category: &str, maps: &[BeatSaverMap]) -> Result<(), String> {
    // Save each map first (this acquires and releases the lock per call)
    for map in maps {
        save_map_to_cache(db, map)?;
    }

    let conn = db.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM bs_browse_entries WHERE category = ?1",
        params![category],
    )
    .map_err(|e| e.to_string())?;

    for (i, map) in maps.iter().enumerate() {
        conn.execute(
            "INSERT INTO bs_browse_entries (category, map_id, sort_order) VALUES (?1,?2,?3)",
            params![category, map.id, i as i64],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn load_browse_from_cache(db: &Database, category: &str) -> Result<Option<Vec<BeatSaverMap>>, String> {
    let map_ids: Vec<String> = {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT map_id FROM bs_browse_entries WHERE category = ?1 ORDER BY sort_order ASC")
            .map_err(|e| e.to_string())?;
        let ids: Vec<String> = stmt
            .query_map(params![category], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        ids
    };

    if map_ids.is_empty() {
        return Ok(None);
    }

    let mut maps = Vec::new();
    for id in &map_ids {
        if let Some(map) = load_map_from_cache(db, id)? {
            maps.push(map);
        }
    }

    if maps.is_empty() {
        Ok(None)
    } else {
        Ok(Some(maps))
    }
}

fn has_downloaded_map(db: &Database, map_id: &str) -> Result<bool, String> {
    let conn = db.conn.lock().unwrap();
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM bs_map_downloads WHERE map_id = ?1",
            params![map_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(exists)
}

fn load_downloaded_map(db: &Database, map_id: &str) -> Result<Option<BeatSaverMapData>, String> {
    let conn = db.conn.lock().unwrap();
    let row = conn
        .query_row(
            "SELECT info_dat, beatmaps_json, audio_base64, cover_base64
             FROM bs_map_downloads WHERE map_id = ?1",
            params![map_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match row {
        None => Ok(None),
        Some((info_dat, beatmaps_json, audio_base64, cover_base64)) => {
            let beatmaps: HashMap<String, String> =
                serde_json::from_str(&beatmaps_json).map_err(|e| e.to_string())?;
            Ok(Some(BeatSaverMapData {
                info_dat,
                beatmaps,
                audio_base64,
                cover_base64,
            }))
        }
    }
}

fn save_downloaded_map(db: &Database, map_id: &str, data: &BeatSaverMapData) -> Result<(), String> {
    let beatmaps_json = serde_json::to_string(&data.beatmaps).map_err(|e| e.to_string())?;
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO bs_map_downloads
         (map_id, info_dat, beatmaps_json, audio_base64, cover_base64)
         VALUES (?1,?2,?3,?4,?5)",
        params![
            map_id,
            data.info_dat,
            beatmaps_json,
            data.audio_base64,
            data.cover_base64,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Shared ZIP extraction (used by both beatsaver_download and queue worker)
// ---------------------------------------------------------------------------

fn extract_map_data(bytes: &[u8]) -> Result<BeatSaverMapData, String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("ZIP error: {}", e))?;

    let mut info_dat = String::new();
    let mut beatmaps: HashMap<String, String> = HashMap::new();
    let mut audio_bytes: Option<Vec<u8>> = None;
    let mut cover_bytes: Option<Vec<u8>> = None;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("ZIP entry error: {}", e))?;
        let name = file.name().to_lowercase();
        let original_name = file.name().to_string();

        if name == "info.dat" {
            file.read_to_string(&mut info_dat)
                .map_err(|e| format!("Read Info.dat: {}", e))?;
        } else if name.ends_with(".dat") && name != "info.dat" {
            let mut content = String::new();
            file.read_to_string(&mut content)
                .map_err(|e| format!("Read {}: {}", original_name, e))?;
            beatmaps.insert(original_name, content);
        } else if name.ends_with(".ogg") || name.ends_with(".egg") {
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)
                .map_err(|e| format!("Read audio: {}", e))?;
            audio_bytes = Some(buf);
        } else if name.ends_with(".jpg") || name.ends_with(".jpeg") || name.ends_with(".png") {
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)
                .map_err(|e| format!("Read cover: {}", e))?;
            cover_bytes = Some(buf);
        }
    }

    let audio_base64 = match audio_bytes {
        Some(bytes) => BASE64.encode(&bytes),
        None => return Err("No audio file found in ZIP".to_string()),
    };

    let cover_base64 = cover_bytes.map(|bytes| BASE64.encode(&bytes));

    if info_dat.is_empty() {
        return Err("No Info.dat found in ZIP".to_string());
    }

    Ok(BeatSaverMapData {
        info_dat,
        beatmaps,
        audio_base64,
        cover_base64,
    })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Legacy direct download command (kept for backward compatibility).
#[tauri::command]
pub async fn beatsaver_download(url: String) -> Result<BeatSaverMapData, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let response =
            reqwest::blocking::get(&url).map_err(|e| format!("Download failed: {}", e))?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        response
            .bytes()
            .map_err(|e| format!("Read failed: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: String| e)?;

    extract_map_data(bytes.as_ref())
}

/// Search BeatSaver maps. Direct command (not queued) since search is interactive.
#[tauri::command]
pub async fn beatsaver_search(
    query: String,
    page: i64,
    filters: BeatSaverSearchFilters,
    db: tauri::State<'_, Database>,
) -> Result<BeatSaverSearchResponse, String> {
    let url = build_search_params(&query, page, &filters);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Search failed: HTTP {}", response.status()));
    }

    let result: BeatSaverSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    // Cache individual maps in background
    for map in &result.docs {
        let _ = save_map_to_cache(&db, map);
    }

    Ok(result)
}

/// Get latest/browse maps by category. Cache-first.
#[tauri::command]
pub async fn beatsaver_browse(
    sort: String,
    page_size: i64,
    db: tauri::State<'_, Database>,
) -> Result<BeatSaverSearchResponse, String> {
    // Check cache first
    if let Ok(Some(cached)) = load_browse_from_cache(&db, &sort) {
        return Ok(BeatSaverSearchResponse {
            docs: cached,
            info: None,
        });
    }

    // Fallback to API
    let url = format!(
        "{}/maps/latest?sort={}&automapper=false&pageSize={}",
        API_BASE,
        urlencoding::encode(&sort),
        page_size
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Browse failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Browse failed: HTTP {}", response.status()));
    }

    let result: BeatSaverSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    // Cache browse category
    let _ = save_browse_to_cache(&db, &sort, &result.docs);

    Ok(result)
}

/// Get a single map by ID. Cache-first.
#[tauri::command]
pub async fn beatsaver_get_map(
    id: String,
    db: tauri::State<'_, Database>,
) -> Result<BeatSaverMap, String> {
    // Check cache first
    if let Ok(Some(cached)) = load_map_from_cache(&db, &id) {
        return Ok(cached);
    }

    // Fallback to API
    let url = format!("{}/maps/id/{}", API_BASE, urlencoding::encode(&id));

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Map fetch failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Map fetch failed: HTTP {}", response.status()));
    }

    let map: BeatSaverMap = response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let _ = save_map_to_cache(&db, &map);

    Ok(map)
}

/// Check if a map's data has been downloaded and cached.
#[tauri::command]
pub fn beatsaver_has_download(
    map_id: String,
    db: tauri::State<'_, Database>,
) -> Result<bool, String> {
    has_downloaded_map(&db, &map_id)
}

/// Download a track synchronously (not queued). Checks cache first.
/// Used for single-track play where we need the result immediately.
#[tauri::command]
pub async fn beatsaver_download_track(
    map_id: String,
    download_url: String,
    db: tauri::State<'_, Database>,
) -> Result<BeatSaverMapData, String> {
    // Check cache first
    if let Some(cached) = load_downloaded_map(&db, &map_id)? {
        return Ok(cached);
    }

    // Download and extract
    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Read failed: {}", e))?;

    let data = extract_map_data(bytes.as_ref())?;

    // Cache the extracted data
    let _ = save_downloaded_map(&db, &map_id, &data);

    Ok(data)
}

/// Enqueue a track for background download+extract.
/// Returns the map_id for event correlation.
#[tauri::command]
pub fn beatsaver_fetch_track(
    map_id: String,
    download_url: String,
    queue: tauri::State<'_, TrackQueue>,
) -> Result<String, String> {
    queue
        .tx
        .send(TrackFetchRequest {
            map_id: map_id.clone(),
            download_url,
        })
        .map_err(|e| format!("Failed to enqueue track fetch: {}", e))?;
    Ok(map_id)
}

// ---------------------------------------------------------------------------
// Background queue worker
// ---------------------------------------------------------------------------

pub fn spawn_track_worker(
    app_handle: AppHandle,
    mut rx: mpsc::UnboundedReceiver<TrackFetchRequest>,
) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();

        while let Some(request) = rx.recv().await {
            let result = process_track_request(&app_handle, &client, &request).await;
            let _ = app_handle.emit("beatsaver:track-ready", &result);
        }
    });
}

async fn process_track_request(
    app_handle: &AppHandle,
    client: &reqwest::Client,
    request: &TrackFetchRequest,
) -> TrackFetchResult {
    let db = app_handle.state::<Database>();

    // Dedup protection: re-check cache before downloading
    if let Ok(true) = has_downloaded_map(&db, &request.map_id) {
        return TrackFetchResult {
            map_id: request.map_id.clone(),
            status: "already_cached".to_string(),
            error: None,
        };
    }

    // Download the ZIP
    let bytes = match client.get(&request.download_url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return TrackFetchResult {
                    map_id: request.map_id.clone(),
                    status: "error".to_string(),
                    error: Some(format!("HTTP {}", resp.status())),
                };
            }
            match resp.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    return TrackFetchResult {
                        map_id: request.map_id.clone(),
                        status: "error".to_string(),
                        error: Some(format!("Download read failed: {}", e)),
                    }
                }
            }
        }
        Err(e) => {
            return TrackFetchResult {
                map_id: request.map_id.clone(),
                status: "error".to_string(),
                error: Some(format!("Download failed: {}", e)),
            }
        }
    };

    // Extract ZIP and cache
    match extract_map_data(bytes.as_ref()) {
        Ok(data) => {
            let _ = save_downloaded_map(&db, &request.map_id, &data);
            TrackFetchResult {
                map_id: request.map_id.clone(),
                status: "success".to_string(),
                error: None,
            }
        }
        Err(e) => TrackFetchResult {
            map_id: request.map_id.clone(),
            status: "error".to_string(),
            error: Some(e),
        },
    }
}
