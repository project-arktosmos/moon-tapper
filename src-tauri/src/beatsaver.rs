use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;

#[derive(Debug, Serialize)]
pub struct BeatSaverMapData {
    pub info_dat: String,
    pub beatmaps: HashMap<String, String>,
    pub audio_base64: String,
    pub cover_base64: Option<String>,
}

/// Download a BeatSaver map ZIP and extract its contents.
/// Returns the Info.dat, all beatmap .dat files, audio as base64, and optional cover as base64.
#[tauri::command]
pub async fn beatsaver_download(url: String) -> Result<BeatSaverMapData, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let response = reqwest::blocking::get(&url).map_err(|e| format!("Download failed: {}", e))?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        response.bytes().map_err(|e| format!("Read failed: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: String| e)?;

    let cursor = std::io::Cursor::new(bytes.as_ref());
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
