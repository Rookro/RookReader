use tauri::{AppHandle, Manager, WebviewWindow};
use tokio::sync::RwLock;

use crate::{
    blocking::run_blocking,
    commands::events::{emit_to, SettingsChanged},
    error::Result,
    settings::{AppSettings, CurrentSettings, SettingsFileProvider, SettingsPatch, SettingsUnread},
    state::container_state::ContainerState,
};

/// Returns the settings the app is running with.
///
/// # Arguments
///
/// * `settings` - The current settings.
///
/// # Returns
///
/// The current [`AppSettings`].
///
/// # Errors
///
/// Never fails; the `Result` keeps the command's shape.
#[tauri::command]
#[specta::specta]
pub async fn get_settings(settings: tauri::State<'_, CurrentSettings>) -> Result<AppSettings> {
    Ok(settings.read().await.clone())
}

/// Applies a partial settings change and returns the full merged settings.
///
/// The `patch` carries only the changed leaves of a single category. The backend
/// deep-merges it into the current settings (or, while the session still runs on the
/// fallback because start-up could not read the settings file, into the file read again),
/// validates the merged whole, persists it, applies the reader/rendering values to the
/// live container runtime, returns the full merged settings to the caller, and broadcasts
/// a `settings-changed` event to every window **except the caller** so other windows
/// re-hydrate.
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
/// * `settings` - The current settings, replaced by the merged ones once they are saved.
/// * `unread` - Set while the session runs on the fallback from an unreadable settings file.
/// * `provider` - The managed settings file provider backing the settings store.
///
/// # Returns
///
/// The full merged [`AppSettings`].
///
/// # Errors
///
/// Returns `Error::SettingsValidation` with one violation per out-of-range or mistyped field,
/// `Error::Settings` if the merged document is invalid otherwise, or an error if the settings
/// file cannot be read again or saved.
#[tauri::command]
#[specta::specta]
pub async fn set_settings<R: tauri::Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    patch: SettingsPatch,
    state: tauri::State<'_, RwLock<ContainerState>>,
    settings: tauri::State<'_, CurrentSettings>,
    unread: tauri::State<'_, SettingsUnread>,
    provider: tauri::State<'_, SettingsFileProvider>,
) -> Result<AppSettings> {
    let caller_label = webview.label().to_string();
    change_settings(&settings, &unread, &provider, &state, patch, |merged| {
        let all_labels: Vec<String> = app.webview_windows().into_keys().collect();
        let event = SettingsChanged(merged.clone());
        for label in settings_change_targets(all_labels, &caller_label) {
            // One window at a time, so a failed send to one does not stop the others.
            emit_to(&app, label.as_str(), &event);
        }
    })
    .await
}

/// Applies `patch` to the current settings: validates the merged whole, saves it, adopts
/// it, applies it to the container state, and announces it.
///
/// While `unread` is set, the patch goes onto the settings file read again instead of onto
/// the fallback in memory; if the file still cannot be read, nothing changes. The marker is
/// cleared once the merged settings are saved and adopted.
///
/// The settings write lock is held to the end, so two changes cannot be saved A, B and
/// then applied or announced B, A. Lock order is settings -> container state.
async fn change_settings(
    current: &CurrentSettings,
    unread: &SettingsUnread,
    provider: &SettingsFileProvider,
    state: &RwLock<ContainerState>,
    patch: SettingsPatch,
    announce: impl FnOnce(&AppSettings),
) -> Result<AppSettings> {
    let mut current = current.write().await;
    let merged = if unread.is_set() {
        let provider = provider.clone();
        run_blocking(move || AppSettings::load(&provider))
            .await?
            .patched(patch)?
    } else {
        current.patched(patch)?
    };
    {
        let provider = provider.clone();
        let to_save = merged.clone();
        run_blocking(move || to_save.save(&provider)).await?;
    }
    *current = merged.clone();
    unread.clear();
    state.write().await.apply_settings(&merged);
    announce(&merged);
    Ok(merged)
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
    use std::sync::atomic::{AtomicUsize, Ordering};

    use serde_json::json;
    use tokio::sync::RwLock;

    use super::*;
    use crate::error::Error;
    use crate::settings::SettingsStoreProvider;

    /// A settings file in `dir`, the default settings as the current ones, and an empty state.
    fn fixture(
        dir: &std::path::Path,
    ) -> (
        SettingsFileProvider,
        CurrentSettings,
        RwLock<ContainerState>,
    ) {
        (
            SettingsFileProvider::at_path(dir.join("settings.json")),
            RwLock::new(AppSettings::default()),
            RwLock::new(ContainerState::default()),
        )
    }

    /// What a session runs on when start-up could not read the settings file.
    fn fallback() -> CurrentSettings {
        let mut settings = AppSettings::default();
        settings.history.record_reading_history = false;
        RwLock::new(settings)
    }

    #[tokio::test]
    async fn a_change_is_saved_and_becomes_the_current_settings() {
        let dir = tempfile::tempdir().unwrap();
        let (provider, current, state) = fixture(dir.path());
        let announced = std::sync::Mutex::new(Vec::new());
        let patch = SettingsPatch::History(json!({ "recordReadingHistory": false }));

        let merged = change_settings(
            &current,
            &SettingsUnread::default(),
            &provider,
            &state,
            patch,
            |merged| {
                announced
                    .lock()
                    .unwrap()
                    .push(merged.history.record_reading_history);
            },
        )
        .await
        .unwrap();

        assert!(!merged.history.record_reading_history);
        assert!(!current.read().await.history.record_reading_history);
        assert!(
            !AppSettings::load(&provider)
                .unwrap()
                .history
                .record_reading_history
        );
        assert_eq!(*announced.lock().unwrap(), vec![false]);
    }

    #[tokio::test]
    async fn a_change_after_an_unread_start_lands_on_the_file_not_on_the_fallback() {
        let dir = tempfile::tempdir().unwrap();
        let (provider, _, state) = fixture(dir.path());
        provider
            .save_all_settings(json!({ "bookshelf": { "gridSize": 2 } }))
            .unwrap();
        let current = fallback();
        let unread = SettingsUnread::new(true);
        let announced = AtomicUsize::new(0);
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 1234 } }));

        let merged = change_settings(&current, &unread, &provider, &state, patch, |_| {
            announced.fetch_add(1, Ordering::SeqCst);
        })
        .await
        .unwrap();

        let saved = AppSettings::load(&provider).unwrap();
        for settings in [&merged, &*current.read().await, &saved] {
            assert_eq!(settings.bookshelf.grid_size, 2);
            assert!(settings.history.record_reading_history);
            assert_eq!(settings.reader.rendering.max_image_height, 1234);
        }
        assert!(!unread.is_set());
        assert_eq!(announced.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_change_fails_while_the_file_is_still_unreadable() {
        let dir = tempfile::tempdir().unwrap();
        let (provider, _, state) = fixture(dir.path());
        let settings_path = dir.path().join("settings.json");
        std::fs::create_dir(&settings_path).unwrap();
        let current = fallback();
        let unread = SettingsUnread::new(true);
        let announced = AtomicUsize::new(0);
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 1234 } }));

        let result = change_settings(&current, &unread, &provider, &state, patch, |_| {
            announced.fetch_add(1, Ordering::SeqCst);
        })
        .await;

        assert!(result.is_err());
        let current = current.read().await;
        assert!(!current.history.record_reading_history);
        assert_eq!(
            current.bookshelf.grid_size,
            AppSettings::default().bookshelf.grid_size
        );
        assert!(unread.is_set());
        assert_eq!(announced.load(Ordering::SeqCst), 0);
        assert!(settings_path.is_dir());
    }

    #[tokio::test]
    async fn an_invalid_change_leaves_the_settings_and_the_file_alone() {
        let dir = tempfile::tempdir().unwrap();
        let (provider, current, state) = fixture(dir.path());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 70000 } }));

        let result = change_settings(
            &current,
            &SettingsUnread::default(),
            &provider,
            &state,
            patch,
            |_| {},
        )
        .await;

        assert!(matches!(result, Err(Error::SettingsValidation(_))));
        assert_eq!(current.read().await.reader.rendering.max_image_height, 0);
        assert!(!dir.path().join("settings.json").exists());
    }

    #[tokio::test]
    async fn a_failed_save_leaves_the_current_settings_alone() {
        let dir = tempfile::tempdir().unwrap();
        // A file where the settings folder should be: nothing can be written beneath it.
        let blocker = dir.path().join("blocker");
        std::fs::write(&blocker, b"").unwrap();
        let provider = SettingsFileProvider::at_path(blocker.join("settings.json"));
        let current = RwLock::new(AppSettings::default());
        let state = RwLock::new(ContainerState::default());
        let announced = AtomicUsize::new(0);
        let patch = SettingsPatch::History(json!({ "recordReadingHistory": false }));

        let result = change_settings(
            &current,
            &SettingsUnread::default(),
            &provider,
            &state,
            patch,
            |_| {
                announced.fetch_add(1, Ordering::SeqCst);
            },
        )
        .await;

        assert!(result.is_err());
        assert!(current.read().await.history.record_reading_history);
        assert_eq!(announced.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn a_change_reaches_the_open_book_settings() {
        let dir = tempfile::tempdir().unwrap();
        let (provider, current, state) = fixture(dir.path());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 1234 } }));

        change_settings(
            &current,
            &SettingsUnread::default(),
            &provider,
            &state,
            patch,
            |_| {},
        )
        .await
        .unwrap();

        assert_eq!(state.read().await.settings.max_image_height, 1234);
    }

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
