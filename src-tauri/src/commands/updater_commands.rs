use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{
    webview::{PageLoadEvent, PageLoadPayload},
    Manager, Runtime, State, Webview, Window, WindowEvent,
};

/// The window showing the update dialog, so that only one window shows it at a time.
///
/// Managed as application state. The holder keeps it until it releases it, its window is
/// destroyed, or its page reloads (see [`release_update_prompt_on_destroy`] and
/// [`release_update_prompt_on_reload`]), so a window closed or reloaded with the dialog
/// open does not block the other window.
#[derive(Default)]
pub struct UpdatePromptLock(Mutex<Option<String>>);

impl UpdatePromptLock {
    /// Claims the prompt for the window `label`; true when it was free or already
    /// held by that window.
    fn claim(&self, label: &str) -> bool {
        let mut holder = self.holder();
        match holder.as_deref() {
            Some(current) if current != label => false,
            _ => {
                *holder = Some(label.to_owned());
                true
            }
        }
    }

    /// Releases the prompt if the window `label` holds it.
    fn release(&self, label: &str) {
        let mut holder = self.holder();
        if holder.as_deref() == Some(label) {
            *holder = None;
        }
    }

    fn holder(&self) -> MutexGuard<'_, Option<String>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Claims the update dialog for the calling window.
///
/// # Arguments
///
/// * `window` - The calling window (Tauri-injected; omitted from the TS signature).
/// * `lock` - The managed update prompt lock.
///
/// # Returns
///
/// `true` if the calling window may show the dialog, `false` if another window shows it.
#[tauri::command]
#[specta::specta]
pub fn claim_update_prompt(window: Window, lock: State<'_, UpdatePromptLock>) -> bool {
    lock.claim(window.label())
}

/// Releases the update dialog if the calling window holds it.
///
/// # Arguments
///
/// * `window` - The calling window (Tauri-injected; omitted from the TS signature).
/// * `lock` - The managed update prompt lock.
#[tauri::command]
#[specta::specta]
pub fn release_update_prompt(window: Window, lock: State<'_, UpdatePromptLock>) {
    lock.release(window.label());
}

/// Window event handler that releases the update dialog held by a destroyed window.
///
/// # Arguments
///
/// * `window` - The window the event belongs to.
/// * `event` - The window event.
pub fn release_update_prompt_on_destroy<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::Destroyed = event {
        if let Some(lock) = window.try_state::<UpdatePromptLock>() {
            lock.release(window.label());
        }
    }
}

/// Checks if the auto-updater is supported on the current platform/environment.
///
/// Returns `true` if the updater is supported, `false` otherwise.
/// - Windows: Always supported.
/// - macOS: Always supported.
/// - Linux: Supported only if running as an AppImage (checked via `APPIMAGE` environment variable).
#[tauri::command]
#[specta::specta]
pub fn is_updater_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::env::var("APPIMAGE").is_ok()
    }

    #[cfg(target_os = "windows")]
    {
        true
    }

    #[cfg(target_os = "macos")]
    {
        true
    }

    // Fallback for other platforms (e.g., Android, iOS) where updater might not be supported
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        false
    }
}

/// Page load handler that releases the update dialog held by a window whose page reloads.
///
/// A reload runs no frontend cleanup, and the reloaded page shows no dialog.
///
/// # Arguments
///
/// * `webview` - The webview whose page is loading.
/// * `payload` - The page load event.
pub fn release_update_prompt_on_reload<R: Runtime>(
    webview: &Webview<R>,
    payload: &PageLoadPayload<'_>,
) {
    if let Some(lock) = webview.try_state::<UpdatePromptLock>() {
        release_on_page_load(&lock, webview.label(), payload.event());
    }
}

fn release_on_page_load(lock: &UpdatePromptLock, label: &str, event: PageLoadEvent) {
    if event == PageLoadEvent::Started {
        lock.release(label);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_window_can_hold_the_update_prompt() {
        let lock = UpdatePromptLock::default();
        assert!(lock.claim("main"));
        assert!(!lock.claim("settings"));
        // A window that already holds it (e.g. after a reload) gets it again.
        assert!(lock.claim("main"));
    }

    #[test]
    fn only_the_holder_releases_the_update_prompt() {
        let lock = UpdatePromptLock::default();
        assert!(lock.claim("main"));
        lock.release("settings");
        assert!(!lock.claim("settings"));
        lock.release("main");
        assert!(lock.claim("settings"));
    }

    #[test]
    fn destroying_the_holding_window_releases_the_update_prompt() {
        // The mock runtime never emits `Destroyed`, so the handler is called directly.
        let app = tauri::test::mock_builder()
            .manage(UpdatePromptLock::default())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let window = tauri::WebviewWindowBuilder::new(&app, "settings", Default::default())
            .build()
            .unwrap()
            .as_ref()
            .window();
        let lock = app.state::<UpdatePromptLock>();
        assert!(lock.claim("settings"));

        release_update_prompt_on_destroy(&window, &WindowEvent::Focused(false));
        assert!(!lock.claim("main"));

        release_update_prompt_on_destroy(&window, &WindowEvent::Destroyed);
        assert!(lock.claim("main"));
    }

    #[test]
    fn reloading_the_holding_window_releases_the_update_prompt() {
        let lock = UpdatePromptLock::default();
        assert!(lock.claim("main"));

        release_on_page_load(&lock, "main", PageLoadEvent::Finished);
        assert!(!lock.claim("settings"));

        release_on_page_load(&lock, "main", PageLoadEvent::Started);
        assert!(lock.claim("settings"));
    }

    #[test]
    fn test_is_updater_supported() {
        let supported = is_updater_supported();

        #[cfg(any(target_os = "windows", target_os = "macos"))]
        assert!(supported);

        #[cfg(target_os = "linux")]
        {
            // Depends on APPIMAGE env var
            let expected = std::env::var("APPIMAGE").is_ok();
            assert_eq!(supported, expected);
        }

        #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
        assert!(!supported);
    }
}
