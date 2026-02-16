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
