use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

/// Request enqueued to the background worker
#[derive(Debug, Clone)]
pub(crate) struct LyricsFetchRequest {
    track_name: String,
    artist_name: Option<String>,
    album_name: Option<String>,
    duration: Option<f64>,
}

/// Raw LRCLIB API response (camelCase to match their JSON)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LrcLibResponse {
    pub id: i64,
    pub track_name: String,
    pub artist_name: String,
    pub album_name: String,
    pub duration: f64,
    pub instrumental: bool,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

/// Event payload emitted to the frontend on fetch completion
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsFetchResult {
    pub cache_key: String,
    pub status: String, // "success" | "not_found" | "error"
    pub data: Option<LrcLibResponse>,
    pub error: Option<String>,
}

/// Return type for lyrics_cache_check
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsCacheEntry {
    pub found: bool,
    pub data: Option<LrcLibResponse>,
}

/// Return type for lyrics_cache_has (lightweight badge check)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsCacheStatus {
    pub found: bool,
    pub has_lyrics: bool,
}

/// Managed Tauri state holding the sender end of the queue channel
pub struct LyricsQueue {
    pub tx: mpsc::UnboundedSender<(LyricsFetchRequest, String)>,
}

// ---------------------------------------------------------------------------
// Cache key (must match the TypeScript logic exactly)
// ---------------------------------------------------------------------------

fn make_cache_key(track_name: &str, artist_name: Option<&str>) -> String {
    let artist = artist_name.unwrap_or("unknown");
    format!("{}:{}", artist, track_name).to_lowercase()
}

// ---------------------------------------------------------------------------
// Direct DB helpers (used by commands and by the worker)
// ---------------------------------------------------------------------------

fn check_cache_internal(db: &Database, cache_key: &str) -> Result<Option<LyricsCacheEntry>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT lrclib_id, track_name, artist_name, album_name, duration,
                    instrumental, plain_lyrics, synced_lyrics, found
             FROM lyrics_cache WHERE cache_key = ?1",
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row(params![cache_key], |row| {
            Ok((
                row.get::<_, Option<i64>>(0)?,  // lrclib_id
                row.get::<_, String>(1)?,        // track_name
                row.get::<_, String>(2)?,        // artist_name
                row.get::<_, String>(3)?,        // album_name
                row.get::<_, f64>(4)?,           // duration
                row.get::<_, bool>(5)?,          // instrumental
                row.get::<_, Option<String>>(6)?, // plain_lyrics
                row.get::<_, Option<String>>(7)?, // synced_lyrics
                row.get::<_, bool>(8)?,          // found
            ))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    match row {
        None => Ok(None),
        Some((lrclib_id, track_name, artist_name, album_name, duration, instrumental, plain_lyrics, synced_lyrics, found)) => {
            if !found {
                Ok(Some(LyricsCacheEntry { found: false, data: None }))
            } else {
                Ok(Some(LyricsCacheEntry {
                    found: true,
                    data: Some(LrcLibResponse {
                        id: lrclib_id.unwrap_or(0),
                        track_name,
                        artist_name,
                        album_name,
                        duration,
                        instrumental,
                        plain_lyrics,
                        synced_lyrics,
                    }),
                }))
            }
        }
    }
}

fn check_cache_has_internal(db: &Database, cache_key: &str) -> Result<Option<LyricsCacheStatus>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT found, synced_lyrics, plain_lyrics FROM lyrics_cache WHERE cache_key = ?1")
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row(params![cache_key], |row| {
            Ok((
                row.get::<_, bool>(0)?,          // found
                row.get::<_, Option<String>>(1)?, // synced_lyrics
                row.get::<_, Option<String>>(2)?, // plain_lyrics
            ))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    match row {
        None => Ok(None),
        Some((found, synced_lyrics, plain_lyrics)) => Ok(Some(LyricsCacheStatus {
            found,
            has_lyrics: synced_lyrics.is_some() || plain_lyrics.is_some(),
        })),
    }
}

fn save_to_cache(db: &Database, cache_key: &str, data: &LrcLibResponse) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO lyrics_cache
         (cache_key, lrclib_id, track_name, artist_name, album_name,
          duration, instrumental, plain_lyrics, synced_lyrics, found)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)",
        params![
            cache_key,
            data.id,
            data.track_name,
            data.artist_name,
            data.album_name,
            data.duration,
            data.instrumental,
            data.plain_lyrics,
            data.synced_lyrics,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn save_not_found(db: &Database, cache_key: &str, track_name: &str, artist_name: &str) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO lyrics_cache (cache_key, track_name, artist_name, found)
         VALUES (?1, ?2, ?3, 0)",
        params![cache_key, track_name, artist_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Fast synchronous cache lookup (no queueing)
#[tauri::command]
pub fn lyrics_cache_check(
    track_name: String,
    artist_name: Option<String>,
    db: tauri::State<'_, Database>,
) -> Result<Option<LyricsCacheEntry>, String> {
    let cache_key = make_cache_key(&track_name, artist_name.as_deref());
    check_cache_internal(&db, &cache_key)
}

/// Lightweight cache check for badge display
#[tauri::command]
pub fn lyrics_cache_has(
    track_name: String,
    artist_name: Option<String>,
    db: tauri::State<'_, Database>,
) -> Result<Option<LyricsCacheStatus>, String> {
    let cache_key = make_cache_key(&track_name, artist_name.as_deref());
    check_cache_has_internal(&db, &cache_key)
}

/// Enqueue a lyrics fetch request. Returns the cache_key for correlation.
#[tauri::command]
pub fn lyrics_fetch(
    track_name: String,
    artist_name: Option<String>,
    album_name: Option<String>,
    duration: Option<f64>,
    queue: tauri::State<'_, LyricsQueue>,
) -> Result<String, String> {
    let cache_key = make_cache_key(&track_name, artist_name.as_deref());
    let request = LyricsFetchRequest {
        track_name,
        artist_name,
        album_name,
        duration,
    };
    queue
        .tx
        .send((request, cache_key.clone()))
        .map_err(|e| format!("Failed to enqueue lyrics fetch: {}", e))?;
    Ok(cache_key)
}

// ---------------------------------------------------------------------------
// Background queue worker
// ---------------------------------------------------------------------------

const LRCLIB_API_BASE: &str = "https://lrclib.net/api";
const USER_AGENT: &str = "MoonTrainer/1.0.0 (https://github.com/arktosmos)";

pub fn spawn_lyrics_worker(
    app_handle: AppHandle,
    mut rx: mpsc::UnboundedReceiver<(LyricsFetchRequest, String)>,
) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();

        while let Some((request, cache_key)) = rx.recv().await {
            let result = process_request(&app_handle, &client, &request, &cache_key).await;
            let _ = app_handle.emit("lyrics:fetch-result", &result);
        }
    });
}

async fn process_request(
    app_handle: &AppHandle,
    client: &reqwest::Client,
    request: &LyricsFetchRequest,
    cache_key: &str,
) -> LyricsFetchResult {
    let db = app_handle.state::<Database>();

    // Re-check cache (dedup protection for rapid duplicate enqueues)
    if let Ok(Some(entry)) = check_cache_internal(&db, cache_key) {
        return LyricsFetchResult {
            cache_key: cache_key.to_string(),
            status: if entry.found { "success" } else { "not_found" }.to_string(),
            data: entry.data,
            error: None,
        };
    }

    // Build query params
    let mut params: Vec<(&str, String)> = vec![("track_name", request.track_name.clone())];
    if let Some(ref artist) = request.artist_name {
        if !artist.is_empty() {
            params.push(("artist_name", artist.clone()));
        }
    }
    if let Some(ref album) = request.album_name {
        if !album.is_empty() {
            params.push(("album_name", album.clone()));
        }
    }
    if let Some(dur) = request.duration {
        if dur > 0.0 {
            params.push(("duration", (dur.round() as i64).to_string()));
        }
    }

    // HTTP request to LRCLIB
    let response = match client
        .get(format!("{}/get", LRCLIB_API_BASE))
        .header("Lrclib-Client", USER_AGENT)
        .query(&params)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            return LyricsFetchResult {
                cache_key: cache_key.to_string(),
                status: "error".to_string(),
                data: None,
                error: Some(format!("HTTP request failed: {}", e)),
            };
        }
    };

    let status_code = response.status().as_u16();

    // 404 → not found
    if status_code == 404 {
        let artist = request.artist_name.as_deref().unwrap_or("unknown");
        let _ = save_not_found(&db, cache_key, &request.track_name, artist);
        return LyricsFetchResult {
            cache_key: cache_key.to_string(),
            status: "not_found".to_string(),
            data: None,
            error: None,
        };
    }

    // Non-success → error (don't cache)
    if !response.status().is_success() {
        return LyricsFetchResult {
            cache_key: cache_key.to_string(),
            status: "error".to_string(),
            data: None,
            error: Some(format!("LRCLIB API error: {}", status_code)),
        };
    }

    // Parse JSON response
    match response.json::<LrcLibResponse>().await {
        Ok(data) => {
            let _ = save_to_cache(&db, cache_key, &data);
            LyricsFetchResult {
                cache_key: cache_key.to_string(),
                status: "success".to_string(),
                data: Some(data),
                error: None,
            }
        }
        Err(e) => LyricsFetchResult {
            cache_key: cache_key.to_string(),
            status: "error".to_string(),
            data: None,
            error: Some(format!("JSON parse error: {}", e)),
        },
    }
}

// Bring the rusqlite optional helper into scope
use rusqlite::OptionalExtension;
