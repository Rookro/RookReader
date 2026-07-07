use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tokio::sync::RwLock;

use crate::{
    error::Result,
    settings::{AppSettings, SettingsFileLock, SettingsFileProvider, SettingsPatch},
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
/// * `provider` - The managed settings file provider backing the settings store.
///
/// # Returns
///
/// The normalized, valid [`AppSettings`].
///
/// # Errors
///
/// Returns an `Err` if the settings cannot be loaded.
#[tauri::command]
#[specta::specta]
pub async fn get_settings(provider: tauri::State<'_, SettingsFileProvider>) -> Result<AppSettings> {
    AppSettings::load(provider.inner())
}

/// Applies a partial settings change and returns the full merged settings.
///
/// The `patch` carries only the changed leaves of a single category. The backend
/// deep-merges it into the current settings, validates the merged whole, persists it,
/// applies the reader/rendering values to the live container runtime, returns the
/// full merged settings to the caller, and broadcasts a `settings-changed` event to
/// every window **except the caller** so other windows re-hydrate.
///
/// The caller is excluded from the emit because it already adopts the change from this
/// command's return value (the `updateSettings` thunk replaces its slice with it); it
/// converges on other windows' changes through *their* emits.
///
/// # Arguments
///
/// * `app` - The Tauri app handle.
/// * `webview` - The window that initiated the change (excluded from the emit; this is
///   a Tauri-injected argument that `tauri-specta` omits from the TS signature).
/// * `patch` - The single-category partial change to apply.
/// * `state` - The application's runtime state.
/// * `lock` - The settings file lock serializing the read-modify-write.
/// * `provider` - The managed settings file provider backing the settings store.
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
#[specta::specta]
pub async fn set_settings(
    app: AppHandle,
    webview: WebviewWindow,
    patch: SettingsPatch,
    state: tauri::State<'_, RwLock<AppState>>,
    lock: tauri::State<'_, SettingsFileLock>,
    provider: tauri::State<'_, SettingsFileProvider>,
) -> Result<AppSettings> {
    // Hold the settings file lock across the persist, the runtime apply, and the
    // broadcast so two concurrent calls cannot persist A,B but then apply/announce B,A.
    // Lock order is SettingsFileLock -> AppState(write); no path takes them the other way.
    let _guard = lock.0.lock().await;

    let settings = AppSettings::apply_patch(provider.inner(), patch)?;

    {
        let mut locked_state = state.write().await;
        setup::apply_reader_settings_to_container(&mut locked_state, &settings);
    }

    let caller_label = webview.label().to_string();
    let all_labels: Vec<String> = app.webview_windows().into_keys().collect();
    for label in settings_change_targets(all_labels, &caller_label) {
        // The settings are already persisted and applied; a failed emit to one window
        // must not abort delivery to the others, so log and continue.
        if let Err(e) = app.emit_to(label.as_str(), SETTINGS_CHANGED_EVENT, &settings) {
            log::warn!("Failed to emit {SETTINGS_CHANGED_EVENT} to window '{label}': {e}");
        }
    }

    Ok(settings)
}

/// Returns the labels of the windows that should receive a `settings-changed` event:
/// every open window except `caller_label`, which already reflects the change locally
/// via this command's return value.
///
/// # Arguments
///
/// * `all_labels` - The labels of every currently open window.
/// * `caller_label` - The label of the window that initiated the change.
///
/// # Returns
///
/// The labels to notify, preserving the input order.
fn settings_change_targets(all_labels: Vec<String>, caller_label: &str) -> Vec<String> {
    all_labels
        .into_iter()
        .filter(|label| label != caller_label)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::settings_change_targets;

    #[test]
    fn settings_change_targets_excludes_the_caller_window() {
        let all = vec!["main".to_string(), "settings".to_string()];
        assert_eq!(
            settings_change_targets(all.clone(), "settings"),
            vec!["main".to_string()]
        );
        assert_eq!(
            settings_change_targets(all, "main"),
            vec!["settings".to_string()]
        );
    }

    #[test]
    fn settings_change_targets_keeps_all_when_caller_is_absent() {
        let all = vec!["main".to_string()];
        assert_eq!(
            settings_change_targets(all, "settings"),
            vec!["main".to_string()]
        );
    }
}
