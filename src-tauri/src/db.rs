use rusqlite::{Connection, Result, params_from_iter, types::Value};
use serde::Serialize;
use serde_json::{json, Value as JsonValue};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Represents a single row from a query result
pub type DbRow = Vec<JsonValue>;

/// Represents the result of a SELECT query
#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<DbRow>,
}

/// Represents the result of an INSERT/UPDATE/DELETE operation
#[derive(Debug, Serialize)]
pub struct ExecuteResult {
    pub rows_affected: usize,
    pub last_insert_id: Option<i64>,
}

/// Database wrapper that holds the SQLite connection
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Create a new database connection at the app's data directory.
    /// Optionally attaches an OpenVGDB database as the "vgdb" schema.
    pub fn new(app_handle: &AppHandle, openvgdb_path: Option<std::path::PathBuf>) -> Result<Self> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");

        // Create directory with proper permissions (0755 on Unix)
        std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

        let db_path = app_dir.join("data.db");
        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrent access
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        // Attach the OpenVGDB database as read-only if the file exists
        if let Some(vgdb_path) = openvgdb_path {
            if vgdb_path.exists() {
                let path_str = vgdb_path.to_str().expect("Invalid OpenVGDB path");
                conn.execute_batch(&format!(
                    "ATTACH DATABASE '{}' AS vgdb;",
                    path_str
                ))?;
                eprintln!("[db] Attached OpenVGDB from {:?}", vgdb_path);
            } else {
                eprintln!("[db] OpenVGDB not found at {:?}, skipping attach", vgdb_path);
            }
        }

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Initialize the database schema, creating tables if they don't exist
    pub fn init(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS cheat_games (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                region TEXT NOT NULL DEFAULT 'Unknown',
                cheat_type TEXT NOT NULL DEFAULT 'Code Breaker',
                filename TEXT NOT NULL DEFAULT '',
                cheat_count INTEGER NOT NULL DEFAULT 0,
                imported_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS cheats (
                id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                description TEXT NOT NULL,
                code TEXT NOT NULL,
                FOREIGN KEY (game_id) REFERENCES cheat_games(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_cheats_game_id ON cheats(game_id);

            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                developer TEXT NOT NULL DEFAULT '',
                publisher TEXT NOT NULL DEFAULT '',
                genre TEXT NOT NULL DEFAULT '',
                release_date TEXT NOT NULL DEFAULT '',
                cover_front TEXT NOT NULL DEFAULT '',
                cover_back TEXT NOT NULL DEFAULT '',
                cover_cart TEXT NOT NULL DEFAULT '',
                reference_url TEXT NOT NULL DEFAULT '',
                regions TEXT NOT NULL DEFAULT '',
                rom_file_name TEXT NOT NULL DEFAULT ''
            );

            CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);",
        )?;

        // Migrate game metadata from OpenVGDB if the games table is empty and vgdb is attached
        let games_count: i64 = conn.query_row("SELECT COUNT(*) FROM games", [], |row| row.get(0))?;
        if games_count == 0 {
            // Check if the vgdb schema is attached
            let has_vgdb: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM pragma_database_list WHERE name = 'vgdb'",
                [],
                |row| row.get(0),
            )?;

            if has_vgdb {
                let migrated = conn.execute(
                    "INSERT INTO games (title, description, developer, publisher, genre, release_date, cover_front, cover_back, cover_cart, reference_url, regions, rom_file_name)
                    SELECT
                        r.releaseTitleName,
                        MAX(COALESCE(r.releaseDescription, '')),
                        MAX(COALESCE(r.releaseDeveloper, '')),
                        MAX(COALESCE(r.releasePublisher, '')),
                        MAX(COALESCE(r.releaseGenre, '')),
                        MAX(COALESCE(r.releaseDate, '')),
                        MAX(COALESCE(r.releaseCoverFront, '')),
                        MAX(COALESCE(r.releaseCoverBack, '')),
                        MAX(COALESCE(r.releaseCoverCart, '')),
                        MAX(COALESCE(r.releaseReferenceURL, '')),
                        GROUP_CONCAT(DISTINCT reg.regionName),
                        MIN(rom.romFileName)
                    FROM vgdb.RELEASES r
                    JOIN vgdb.ROMs rom ON r.romID = rom.romID
                    LEFT JOIN vgdb.REGIONS reg ON rom.regionID = reg.regionID
                    WHERE rom.systemID = 20
                    GROUP BY r.releaseTitleName
                    ORDER BY r.releaseTitleName",
                    [],
                )?;
                eprintln!("[db] Migrated {} games from OpenVGDB into data.db", migrated);
            }
        }

        Ok(())
    }

    /// Execute a SELECT query and return results as JSON
    /// This is the generic query executor - TypeScript assembles queries, Rust just runs them
    pub fn query(&self, sql: &str, params: Vec<JsonValue>) -> Result<QueryResult> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(sql)?;

        // Convert JSON params to rusqlite Values
        let sqlite_params: Vec<Value> = params.iter().map(json_to_sqlite_value).collect();

        // Get column names
        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        // Execute and collect rows
        let mut rows_result = stmt.query(params_from_iter(sqlite_params))?;
        let mut rows: Vec<DbRow> = Vec::new();

        while let Some(row) = rows_result.next()? {
            let mut row_data: DbRow = Vec::new();
            for i in 0..columns.len() {
                let value = sqlite_value_to_json(row, i);
                row_data.push(value);
            }
            rows.push(row_data);
        }

        Ok(QueryResult { columns, rows })
    }

    /// Execute an INSERT/UPDATE/DELETE statement
    /// Returns rows affected and last insert ID (for INSERTs)
    pub fn execute(&self, sql: &str, params: Vec<JsonValue>) -> Result<ExecuteResult> {
        let conn = self.conn.lock().unwrap();

        // Convert JSON params to rusqlite Values
        let sqlite_params: Vec<Value> = params.iter().map(json_to_sqlite_value).collect();

        let rows_affected = conn.execute(sql, params_from_iter(sqlite_params))?;
        let last_insert_id = if sql.trim().to_uppercase().starts_with("INSERT") {
            Some(conn.last_insert_rowid())
        } else {
            None
        };

        Ok(ExecuteResult {
            rows_affected,
            last_insert_id,
        })
    }
}

/// Convert a serde_json Value to a rusqlite Value
fn json_to_sqlite_value(v: &JsonValue) -> Value {
    match v {
        JsonValue::Null => Value::Null,
        JsonValue::Bool(b) => Value::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                Value::Real(f)
            } else {
                Value::Null
            }
        }
        JsonValue::String(s) => Value::Text(s.clone()),
        JsonValue::Array(_) | JsonValue::Object(_) => Value::Text(v.to_string()),
    }
}

/// Convert a rusqlite row value to a serde_json Value
fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> JsonValue {
    // Try different types in order of likelihood
    if let Ok(i) = row.get::<_, i64>(idx) {
        return json!(i);
    }
    if let Ok(f) = row.get::<_, f64>(idx) {
        return json!(f);
    }
    if let Ok(s) = row.get::<_, String>(idx) {
        return json!(s);
    }
    if let Ok(b) = row.get::<_, Vec<u8>>(idx) {
        // Return blob as base64-encoded string
        return json!(base64_encode(&b));
    }
    // Null or unknown type
    JsonValue::Null
}

/// Simple base64 encoding for blobs
fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
        let b2 = chunk.get(2).copied().unwrap_or(0) as usize;

        result.push(ALPHABET[b0 >> 2] as char);
        result.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        if chunk.len() > 1 {
            result.push(ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(ALPHABET[b2 & 0x3f] as char);
        } else {
            result.push('=');
        }
    }
    result
}
