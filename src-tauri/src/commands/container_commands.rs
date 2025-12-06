use std::sync::{Arc, Mutex};

use crate::{container::image::Image, state::app_state::AppState};

/// Gets entries in the specified archive container.
///
/// * `path` - The path of the archive container.
/// * `state` - The application state.
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

/// Gets an image in the specified archive container.
///
/// * `path` - The path of the archive container.
/// * `entry_name` - The entry name of the image to get.
/// * `state` - The application state.
#[tauri::command()]
pub fn get_image(
    path: String,
    entry_name: String,
    state: tauri::State<Mutex<AppState>>,
) -> Result<Arc<Image>, String> {
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

/// Preloads images in the specified archive container asynchronously.
///
/// * `start_index` - The starting index of the pages to preload.
/// * `count` - The number of pages to preload.
/// * `state` - The application state.
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

/// Sets the image height for PDF rendering.
///
/// * `height` - The image height.
/// * `state` - The application state.
#[tauri::command()]
pub fn set_pdf_rendering_height(
    height: i32,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    log::debug!("set_pdf_rendering_height({})", height);

    let mut state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    state_lock.container_state.settings.pdf_rendering_height = height;
    Ok(())
}
