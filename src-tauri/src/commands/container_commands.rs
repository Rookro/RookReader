use std::sync::{Arc, Mutex};

use crate::container::container::Image;
use crate::state::app_state::AppState;

/// 指定された書庫コンテナー内のエントリーを取得する
///
/// * `path` - 書庫コンテナーのパス
/// * `state` - アプリケーションのステート
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

/// 指定された書庫コンテナー内の画像を取得する
///
/// * `path` - 書庫コンテナーのパス
/// * `entry_name` - 取得する画像のエントリー名
/// * `state` - アプリケーションのステート
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

/// 指定された書庫コンテナー内の画像を非同期で事前ロードする
///
/// * `start_index` - 事前ロードするページの開始インデックス
/// * `count` - 事前ロードするページ数
/// * `state` - アプリケーションのステート
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

/// PDF レンダリング時の画像幅を設定する
///
/// * `height` - 画像幅
/// * `state` - アプリケーションのステート
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
