// CapsuleCraft — Tauri (Rust) native backend.
// Provides real filesystem persistence + native dialogs for the React core.
use notify_debouncer_mini::notify::RecommendedWatcher;
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebounceEventResult, Debouncer};
use std::fs;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

pub struct VaultWatcherState(pub std::sync::Mutex<Option<Debouncer<RecommendedWatcher>>>);

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFsChange {
    pub path: String,
    pub file_name: String,
    pub kind: String, // "modify" | "remove"
}

/// Read a UTF-8 text file from disk (vault JSON, .eml capsules, exports).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read failed: {e}"))
}

/// Write a UTF-8 text file to disk (atomic-ish: write to temp, then rename).
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    eprintln!("[CapsuleCraft] write_text_file called: {}", path);
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, content).map_err(|e| format!("write failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("commit failed: {e}"))
}

/// Check whether a path exists on disk.
#[tauri::command]
fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Create a directory (and parents) if missing.
#[tauri::command]
fn mkdir_dir(path: String) -> Result<(), String> {
    eprintln!("[CapsuleCraft] mkdir_dir called: {}", path);
    fs::create_dir_all(&path).map_err(|e| format!("mkdir failed: {e}"))
}

/// List file names (not dirs) in a directory. Returns empty vec if missing.
#[tauri::command]
fn list_dir(path: String) -> Result<Vec<String>, String> {
    let entries = match fs::read_dir(&path) {
        Ok(e) => e,
        Err(_) => return Ok(vec![]),
    };
    let mut names = Vec::new();
    for entry in entries.flatten() {
        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if ft.is_file() {
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Delete a file if it exists.
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    match fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("delete failed: {e}")),
    }
}

/// Write a binary file (base64 payload) to disk — used for EPUB/PDF exports.
#[tauri::command]
fn write_binary_file(path: String, base64_content: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| format!("base64 decode failed: {e}"))?;
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, &bytes).map_err(|e| format!("write failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("commit failed: {e}"))
}

/// Native "Save As…" dialog. Returns chosen path or None if cancelled.
#[tauri::command]
async fn pick_save_path(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .blocking_save_file();
    Ok(picked
        .and_then(|p| p.into_path().ok())
        .map(|p| p.display().to_string()))
}

/// Native "Open…" dialog with an optional extension filter.
#[tauri::command]
async fn pick_open_path(
    app: AppHandle,
    filter_ext: Option<String>,
) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file();
    if let Some(ext) = filter_ext {
        let name = format!("*{ext}");
        builder = builder.add_filter("Data", &[name.as_str()]);
    }
    let picked = builder.blocking_pick_file();
    Ok(picked
        .and_then(|p| p.into_path().ok())
        .map(|p| p.display().to_string()))
}

/// Cross-platform app data directory (per-user, versioned). Creates it if missing.
#[tauri::command]
fn app_data_dir(app: AppHandle) -> Result<String, String> {
    eprintln!("[CapsuleCraft] app_data_dir called");
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir failed: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir failed: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let dir = match app.path().app_data_dir() {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("[CapsuleCraft] Failed to get app_data_dir for watcher: {e}");
                    return Ok(());
                }
            };
            let vault_dir = dir.join("vault");
            if let Err(e) = fs::create_dir_all(&vault_dir) {
                eprintln!("[CapsuleCraft] Failed to create vault dir: {e}");
                return Ok(());
            }

            let handle_for_watcher = app_handle.clone();
            let debouncer = match new_debouncer(
                Duration::from_millis(150),
                move |res: DebounceEventResult| {
                    match res {
                        Ok(events) => {
                            let mut changes = Vec::new();
                            for event in events {
                                let path = event.path;
                                let file_name = match path.file_name().and_then(|n| n.to_str()) {
                                    Some(name) => name.to_string(),
                                    None => continue,
                                };

                                // Filter: only .eml files, ignore .tmp or temporary files
                                let lower = file_name.to_lowercase();
                                if !lower.ends_with(".eml")
                                    || lower.ends_with(".tmp")
                                    || lower.starts_with('.')
                                {
                                    continue;
                                }

                                let kind = if path.exists() {
                                    "modify".to_string()
                                } else {
                                    "remove".to_string()
                                };

                                changes.push(VaultFsChange {
                                    path: path.to_string_lossy().to_string(),
                                    file_name,
                                    kind,
                                });
                            }

                            if !changes.is_empty() {
                                if let Err(e) = handle_for_watcher.emit("vault:fs-change", &changes)
                                {
                                    eprintln!("[CapsuleCraft] emit vault:fs-change failed: {e}");
                                }
                            }
                        }
                        Err(err) => {
                            eprintln!("[CapsuleCraft] Watcher error: {:?}", err);
                        }
                    }
                },
            ) {
                Ok(mut d) => {
                    if let Err(e) = d.watcher().watch(&vault_dir, RecursiveMode::NonRecursive) {
                        eprintln!("[CapsuleCraft] Watcher watch failed: {e}");
                    }
                    Some(d)
                }
                Err(e) => {
                    eprintln!("[CapsuleCraft] Failed to create debouncer: {e}");
                    None
                }
            };

            app.manage(VaultWatcherState(std::sync::Mutex::new(debouncer)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            write_binary_file,
            path_exists,
            mkdir_dir,
            list_dir,
            delete_file,
            pick_save_path,
            pick_open_path,
            app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
