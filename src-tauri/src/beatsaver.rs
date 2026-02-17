use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
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
// Extracted map data
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeatSaverMapData {
    pub info_dat: String,
    pub beatmaps: HashMap<String, String>,
    pub audio_base64: String,
    pub cover_base64: Option<String>,
}

// ---------------------------------------------------------------------------
// Queue types for background track downloads
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
// Filesystem download cache helpers
// ---------------------------------------------------------------------------

fn downloads_dir(app_handle: &AppHandle) -> std::path::PathBuf {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    app_dir.join("downloads")
}

fn download_path(app_handle: &AppHandle, map_id: &str) -> std::path::PathBuf {
    downloads_dir(app_handle).join(format!("{}.json", map_id))
}

fn has_downloaded_map(app_handle: &AppHandle, map_id: &str) -> bool {
    download_path(app_handle, map_id).exists()
}

fn load_downloaded_map(app_handle: &AppHandle, map_id: &str) -> Result<Option<BeatSaverMapData>, String> {
    let path = download_path(app_handle, map_id);
    if !path.exists() {
        return Ok(None);
    }
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read download cache: {}", e))?;
    let data: BeatSaverMapData = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse download cache: {}", e))?;
    Ok(Some(data))
}

fn save_downloaded_map(app_handle: &AppHandle, map_id: &str, data: &BeatSaverMapData) -> Result<(), String> {
    let dir = downloads_dir(app_handle);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create downloads directory: {}", e))?;
    let path = dir.join(format!("{}.json", map_id));
    let json = serde_json::to_string(data)
        .map_err(|e| format!("Failed to serialize download data: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write download cache: {}", e))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Shared ZIP extraction
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

/// Search BeatSaver maps.
#[tauri::command]
pub async fn beatsaver_search(
    query: String,
    page: i64,
    filters: BeatSaverSearchFilters,
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

    response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))
}

/// Get latest/browse maps by category.
#[tauri::command]
pub async fn beatsaver_browse(
    sort: String,
    page_size: i64,
) -> Result<BeatSaverSearchResponse, String> {
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

    response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))
}

/// Get a single map by ID.
#[tauri::command]
pub async fn beatsaver_get_map(
    id: String,
) -> Result<BeatSaverMap, String> {
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

    response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))
}

/// Check if a map's data has been downloaded and cached on disk.
#[tauri::command]
pub fn beatsaver_has_download(
    map_id: String,
    app_handle: AppHandle,
) -> Result<bool, String> {
    Ok(has_downloaded_map(&app_handle, &map_id))
}

/// Download a track synchronously. Checks filesystem cache first.
#[tauri::command]
pub async fn beatsaver_download_track(
    map_id: String,
    download_url: String,
    app_handle: AppHandle,
) -> Result<BeatSaverMapData, String> {
    // Check filesystem cache first
    if let Some(cached) = load_downloaded_map(&app_handle, &map_id)? {
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

    // Cache to filesystem
    let _ = save_downloaded_map(&app_handle, &map_id, &data);

    Ok(data)
}

/// Enqueue a track for background download+extract.
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
    // Dedup protection: re-check cache before downloading
    if has_downloaded_map(app_handle, &request.map_id) {
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

    // Extract ZIP and cache to filesystem
    match extract_map_data(bytes.as_ref()) {
        Ok(data) => {
            let _ = save_downloaded_map(app_handle, &request.map_id, &data);
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
