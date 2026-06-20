use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

use crate::{
    error::Result,
    settings::{AppSettings, SettingsFileLock, SettingsPatch, TauriStoreProvider},
    setup,
    state::app_state::AppState,
};

/// The event name broadcast to windows when settings change.
const SETTINGS_CHANGED_EVENT: &str = "settings-changed";

/// Reads the current application settings.
///
/// This is a **pure read**: it loads and normalizes the stored settings without
/// acquiring the file lock or writing back. A file hand-edited to an out-of-range
/// value is repaired in memory here and healed on disk at the next startup or write.
///
/// # Arguments
///
/// * `app` - The Tauri app handle, used to access the settings store.
///
/// # Returns
///
/// The normalized, valid [`AppSettings`].
///
/// # Errors
///
/// Returns an `Err` if the settings cannot be loaded.
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings> {
    let provider = TauriStoreProvider::new(&app, setup::settings_filename());
    AppSettings::load(&provider)
}

/// Applies a partial settings change and returns the full merged settings.
///
/// The `patch` carries only the changed leaves of a single category. The backend
/// deep-merges it into the current settings, validates the merged whole, persists it,
/// applies the reader/rendering values to the live container runtime, and broadcasts
/// a `settings-changed` event so other windows re-hydrate.
///
/// # Arguments
///
/// * `app` - The Tauri app handle.
/// * `patch` - The single-category partial change to apply.
/// * `state` - The application's runtime state.
/// * `lock` - The settings file lock serializing the read-modify-write.
///
/// # Returns
///
/// The full merged [`AppSettings`].
///
/// # Errors
///
/// Returns `Error::Settings` if the merged result is invalid (e.g. out of range),
/// or a persistence/emit error.
#[tauri::command]
pub async fn set_settings(
    app: AppHandle,
    patch: SettingsPatch,
    state: tauri::State<'_, RwLock<AppState>>,
    lock: tauri::State<'_, SettingsFileLock>,
) -> Result<AppSettings> {
    let provider = TauriStoreProvider::new(&app, setup::settings_filename());
    let settings = AppSettings::apply_patch_serialized(&provider, &lock.0, patch).await?;

    {
        let mut locked_state = state.write().await;
        setup::apply_reader_settings_to_container(&mut locked_state, &settings);
    }

    // Phase 1: emit to all windows. The caller also receives this (idempotent, as it
    // already applied the returned value). Phase 7 excludes the caller.
    app.emit(SETTINGS_CHANGED_EVENT, &settings)?;

    Ok(settings)
}
