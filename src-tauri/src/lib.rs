mod beatsaver;
mod db;
mod lyrics;

use db::{Database, ExecuteResult, QueryResult};
use serde_json::Value as JsonValue;
use tauri::State;

#[cfg(desktop)]
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
#[cfg(desktop)]
use tauri::LogicalSize;
use tauri::Manager;

/// Delete a sticker character folder from static/stickers/{collection}/{path}
/// If the folder is already gone, just regenerates the manifest to clean up stale entries.
#[tauri::command]
fn sticker_delete_character(collection_base: String, character_path: String) -> Result<(), String> {
    let project_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Cannot resolve project root")?;
    let stickers_dir = project_root.join("static").join("stickers");

    let target = stickers_dir
        .join(&collection_base)
        .join(&character_path);

    // Delete if the folder still exists on disk
    if target.exists() {
        let canonical_stickers = stickers_dir.canonicalize().map_err(|e| e.to_string())?;
        let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
        if !canonical_target.starts_with(&canonical_stickers) {
            return Err("Invalid path: outside stickers directory".into());
        }
        if canonical_target.is_dir() {
            std::fs::remove_dir_all(&canonical_target).map_err(|e| e.to_string())?;
        }
    }

    // Always regenerate the manifest to clean up stale entries
    let output = std::process::Command::new("node")
        .arg(project_root.join("scripts").join("generate-sticker-manifest.js"))
        .current_dir(project_root)
        .output()
        .map_err(|e| format!("Failed to run manifest generator: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Manifest generation failed: {}", stderr));
    }

    Ok(())
}

/// Copy a specific animation frame to the top-level sticker PNG and persist the choice
/// in _frames/selection.json so the UI can show which frame is selected.
#[tauri::command]
fn sticker_set_frame(
    collection_base: String,
    sprite_name: String,
    frame_idx: u32,
) -> Result<(), String> {
    let project_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Cannot resolve project root")?;
    let stickers_dir = project_root.join("static").join("stickers");
    let collection_dir = stickers_dir.join(&collection_base);

    let frame_src = collection_dir
        .join("_frames")
        .join(&sprite_name)
        .join(format!("{}.png", frame_idx));
    let dest = collection_dir.join(format!("{}.png", sprite_name));

    // Validate paths stay within stickers directory
    let canonical_stickers = stickers_dir.canonicalize().map_err(|e| e.to_string())?;
    let canonical_src = frame_src.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_src.starts_with(&canonical_stickers) {
        return Err("Invalid path: source outside stickers directory".into());
    }

    // Copy frame to top-level
    std::fs::copy(&canonical_src, &dest).map_err(|e| e.to_string())?;

    // Update selection.json
    let selection_path = collection_dir.join("_frames").join("selection.json");
    let mut selections: serde_json::Map<String, serde_json::Value> =
        if selection_path.exists() {
            let data = std::fs::read_to_string(&selection_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            serde_json::Map::new()
        };
    selections.insert(sprite_name, serde_json::Value::from(frame_idx as u64));
    let json = serde_json::to_string_pretty(&selections).map_err(|e| e.to_string())?;
    std::fs::write(&selection_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

/// Write a text file to a given path
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

/// Execute a SELECT query and return results
/// TypeScript assembles the SQL queries and types, Rust just executes them
#[tauri::command]
fn db_query(sql: String, params: Vec<JsonValue>, db: State<Database>) -> Result<QueryResult, String> {
    db.query(&sql, params).map_err(|e| e.to_string())
}

/// Execute an INSERT/UPDATE/DELETE statement
/// Returns rows affected and last insert ID for INSERTs
#[tauri::command]
fn db_execute(sql: String, params: Vec<JsonValue>, db: State<Database>) -> Result<ExecuteResult, String> {
    db.execute(&sql, params).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            db_query,
            db_execute,
            beatsaver::beatsaver_download,
            lyrics::lyrics_cache_check,
            lyrics::lyrics_cache_has,
            lyrics::lyrics_fetch,
            sticker_delete_character,
            sticker_set_frame,
            write_text_file
        ]);

    #[cfg(desktop)]
    {
        builder = builder.on_menu_event(|app, event| {
            let window = app.get_webview_window("main").unwrap();
            match event.id().as_ref() {
                // Display sizes
                "size_mobile" => {
                    // iPhone 16 Pro Max viewport: 440 × 956 CSS pixels
                    let _ = window.set_size(LogicalSize::new(440, 956));
                }
                "size_800x600" => {
                    let _ = window.set_size(LogicalSize::new(800, 600));
                }
                "size_1024x768" => {
                    let _ = window.set_size(LogicalSize::new(1024, 768));
                }
                "size_1280x720" => {
                    let _ = window.set_size(LogicalSize::new(1280, 720));
                }
                "size_1920x1080" => {
                    let _ = window.set_size(LogicalSize::new(1920, 1080));
                }
                "size_2560x1440" => {
                    let _ = window.set_size(LogicalSize::new(2560, 1440));
                }
                "display_maximize" => {
                    let _ = window.maximize();
                }
                "display_fullscreen" => {
                    if let Ok(is_fullscreen) = window.is_fullscreen() {
                        let _ = window.set_fullscreen(!is_fullscreen);
                    }
                }
                _ => {}
            }
        });
    }

    builder
        .setup(|app| {
            // Resolve the bundled OpenVGDB database path
            let openvgdb_path = app
                .path()
                .resource_dir()
                .ok()
                .map(|dir| dir.join("resources/openvgdb.sqlite"));

            let db = Database::new(app.handle(), openvgdb_path)?;
            db.init().expect("Failed to initialize database");
            app.manage(db);

            // Initialize lyrics queue worker
            let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
            app.manage(lyrics::LyricsQueue { tx });
            lyrics::spawn_lyrics_worker(app.handle().clone(), rx);

            #[cfg(desktop)]
            {
                // Display/Window sizing menu
                let size_mobile = MenuItemBuilder::with_id("size_mobile", "Mobile")
                    .build(app)?;
                let size_800x600 = MenuItemBuilder::with_id("size_800x600", "800 × 600")
                    .build(app)?;
                let size_1024x768 = MenuItemBuilder::with_id("size_1024x768", "1024 × 768")
                    .build(app)?;
                let size_1280x720 = MenuItemBuilder::with_id("size_1280x720", "1280 × 720 (HD)")
                    .build(app)?;
                let size_1920x1080 = MenuItemBuilder::with_id("size_1920x1080", "1920 × 1080 (Full HD)")
                    .build(app)?;
                let size_2560x1440 = MenuItemBuilder::with_id("size_2560x1440", "2560 × 1440 (QHD)")
                    .build(app)?;
                let maximize_item = MenuItemBuilder::with_id("display_maximize", "Maximize")
                    .accelerator("CmdOrCtrl+Shift+M")
                    .build(app)?;
                let fullscreen_item = MenuItemBuilder::with_id("display_fullscreen", "Toggle Fullscreen")
                    .accelerator("CmdOrCtrl+Shift+F")
                    .build(app)?;

                let display_menu = SubmenuBuilder::new(app, "Display")
                    .item(&size_mobile)
                    .item(&PredefinedMenuItem::separator(app)?)
                    .item(&size_800x600)
                    .item(&size_1024x768)
                    .item(&size_1280x720)
                    .item(&size_1920x1080)
                    .item(&size_2560x1440)
                    .item(&PredefinedMenuItem::separator(app)?)
                    .item(&maximize_item)
                    .item(&fullscreen_item)
                    .build()?;

                let menu = Menu::with_items(app, &[&display_menu])?;
                app.set_menu(menu)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
