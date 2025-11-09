use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::read_dir;
use std::sync::Mutex;

use crate::container::container::Image;
use crate::state::app_state::AppState;

#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    pub is_directory: bool,
    pub name: String,
    pub last_modified: String,
}

#[tauri::command()]
pub fn get_entries_in_dir(dir_path: String) -> Result<Vec<DirEntry>, String> {
    log::debug!("Get the directory entries in {}", dir_path);
    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_e| "failed to get file name from DirEntry.")?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let last_modified = entry
            .metadata()
            .map_err(|e| e.to_string())?
            .modified()
            .map_err(|e| e.to_string())?;

        let last_modified_time: DateTime<Utc> = last_modified.into();

        entries.push(DirEntry {
            is_directory: file_type.is_dir(),
            name: file_name,
            last_modified: last_modified_time.to_rfc3339(),
        });
    }

    Ok(entries)
}

#[tauri::command()]
pub fn get_entries_in_container(
    path: String,
    state: tauri::State<Mutex<AppState>>,
) -> Result<Vec<String>, String> {
    log::debug!("Get the entries in {}", path);
    let mut state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    state_lock
        .container_state
        .open_container(&path)
        .map_err(|e| format!("Failed to get entries in the container. {}", e))?;

    if let Some(container) = &state_lock.container_state.container {
        Ok(container
            .lock()
            .map_err(|e| format!("Failed to lock container of container state. {}", e))?
            .get_entries()
            .clone())
    } else {
        log::error!("Unexpected error. Container is empty!");
        Err(String::from("Unexpected error. Container is empty!"))
    }
}

#[tauri::command()]
pub fn get_image(
    path: String,
    entry_name: String,
    state: tauri::State<Mutex<AppState>>,
) -> Result<Image, String> {
    log::debug!("Get the binary of {} in {}", entry_name, path);

    let state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    if let Some(container) = &state_lock.container_state.container {
        let image = container
            .lock()
            .map_err(|e| format!("Failed to lock container of container state. {}", e))?
            .get_image(&entry_name)
            .map_err(|e| format!("Failed to get image. {}", e))?;
        Ok(image)
    } else {
        log::error!("Unexpected error. Container is empty!");
        Err(String::from("Unexpected error. Container is empty!"))
    }
}

#[tauri::command(async)]
pub async fn async_preload(
    start_index: usize,
    count: usize,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    log::debug!("async_preload({}, {})", start_index, count);

    let state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    if let Some(container) = &state_lock.container_state.container {
        container
            .lock()
            .map_err(|e| format!("Failed to lock container of container state. {}", e))?
            .preload(start_index, count)
            .map_err(|e| format!("Failed to preload. {}", e))
    } else {
        log::error!("Unexpected error. Container is empty!");
        Err(String::from("Unexpected error. Container is empty!"))
    }
}
