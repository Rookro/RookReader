//! Saves and restores the window sizes on Linux, where `tauri-plugin-window-state` cannot.
//!
//! On Linux, tao reports a window's size from the GTK configure event, which under
//! client-side decorations (GNOME, Wayland) also covers the header bar and the shadow,
//! while `set_size` resizes only the content (`gtk_window_resize`). The window-state
//! plugin saves the former and restores it with the latter, so every launch grows the
//! window by its decorations (<https://github.com/tauri-apps/tao/issues/929>). This
//! plugin reads the size with `gtk_window_get_size`, the counterpart of
//! `gtk_window_resize`, so a saved size restores unchanged.

use std::{
    collections::HashMap,
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
};

use gtk::prelude::GtkWindowExt;
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    LogicalSize, Manager, RunEvent, Runtime, Window, WindowEvent,
};

use crate::{error::Result, infrastructure::atomic_file::write_atomically, setup};

/// The file in the app data directory that holds the saved sizes.
const FILENAME: &str = "window-size.json";

/// A window's content size in logical pixels, as GTK reports and sets it.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
struct SavedSize {
    width: u32,
    height: u32,
}

impl SavedSize {
    /// Converts a size reported by GTK, which is `None` unless both sides are positive.
    fn from_gtk(width: i32, height: i32) -> Option<Self> {
        let width = u32::try_from(width).ok().filter(|w| *w > 0)?;
        let height = u32::try_from(height).ok().filter(|h| *h > 0)?;
        Some(Self { width, height })
    }
}

/// The saved sizes, keyed by window label, and the file they persist to.
struct SavedSizes {
    path: PathBuf,
    sizes: Mutex<HashMap<String, SavedSize>>,
}

/// Builds the plugin that restores each window's size when it is created, records it on
/// every resize and saves the sizes when the app exits.
///
/// `tauri-plugin-window-state` must exclude `StateFlags::SIZE` so that only this plugin
/// restores the size.
///
/// # Returns
///
/// The plugin to pass to `tauri::Builder::plugin`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("linux-window-size")
        .setup(|app, _api| {
            let path = setup::app_data_dir(app)?.join(FILENAME);
            let sizes = Mutex::new(load(&path));
            app.manage(SavedSizes { path, sizes });
            Ok(())
        })
        .on_window_ready(|window| {
            restore(&window);
            let tracked = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Resized(_) = event {
                    record(&tracked);
                }
            });
        })
        .on_event(|app, event| {
            if let RunEvent::Exit = event {
                let saved = app.state::<SavedSizes>();
                let sizes = saved.sizes.lock().unwrap_or_else(PoisonError::into_inner);
                if let Err(e) = save(&saved.path, &sizes) {
                    log::warn!("Failed to save the window sizes: {}", e);
                }
            }
        })
        .build()
}

/// Resizes `window` to its saved size, if one was saved.
fn restore<R: Runtime>(window: &Window<R>) {
    let saved = window.state::<SavedSizes>();
    let sizes = saved.sizes.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(size) = sizes.get(window.label()) {
        if let Err(e) = window.set_size(LogicalSize::new(size.width, size.height)) {
            log::warn!(
                "Failed to restore the size of window {}: {}",
                window.label(),
                e
            );
        }
    }
}

/// Records the current size of `window`.
///
/// A maximized, full-screen or minimized window keeps the size recorded before, so it
/// restores to the size it had before it was maximized, even when it is closed
/// maximized.
fn record<R: Runtime>(window: &Window<R>) {
    match content_size(window) {
        Ok(Some(size)) => {
            let saved = window.state::<SavedSizes>();
            let mut sizes = saved.sizes.lock().unwrap_or_else(PoisonError::into_inner);
            sizes.insert(window.label().to_string(), size);
        }
        Ok(None) => {}
        Err(e) => log::warn!(
            "Failed to read the size of window {}: {}",
            window.label(),
            e
        ),
    }
}

/// Returns the content size of `window`, or `None` when it is maximized, full screen,
/// minimized or has no area.
fn content_size<R: Runtime>(window: &Window<R>) -> tauri::Result<Option<SavedSize>> {
    if window.is_maximized()? || window.is_fullscreen()? || window.is_minimized()? {
        return Ok(None);
    }
    let (width, height) = window.gtk_window()?.size();
    Ok(SavedSize::from_gtk(width, height))
}

/// Reads the saved sizes from `path`.
///
/// A missing or unreadable file yields no sizes, so the windows open at their default
/// size.
fn load(path: &Path) -> HashMap<String, SavedSize> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == ErrorKind::NotFound => return HashMap::new(),
        Err(e) => {
            log::warn!("Failed to read the window sizes: {}", e);
            return HashMap::new();
        }
    };
    serde_json::from_slice(&bytes).unwrap_or_else(|e| {
        log::warn!("Ignoring the unparsable window sizes: {}", e);
        HashMap::new()
    })
}

/// Writes `sizes` to `path`.
///
/// # Errors
///
/// Returns an `Err` if the sizes cannot be serialized or the file cannot be written.
fn save(path: &Path, sizes: &HashMap<String, SavedSize>) -> Result<()> {
    let json = serde_json::to_string_pretty(sizes)?;
    write_atomically(path, json.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gtk_sizes_without_area_are_not_recorded() {
        assert_eq!(
            SavedSize::from_gtk(1240, 690),
            Some(SavedSize {
                width: 1240,
                height: 690
            })
        );
        assert_eq!(SavedSize::from_gtk(0, 690), None);
        assert_eq!(SavedSize::from_gtk(1240, -1), None);
    }

    #[test]
    fn saved_sizes_load_back_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILENAME);
        let sizes = HashMap::from([
            (
                "main".to_string(),
                SavedSize {
                    width: 1240,
                    height: 690,
                },
            ),
            (
                "settings".to_string(),
                SavedSize {
                    width: 940,
                    height: 450,
                },
            ),
        ]);

        save(&path, &sizes).unwrap();

        assert_eq!(load(&path), sizes);
    }

    #[test]
    fn a_missing_or_unparsable_file_yields_no_sizes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILENAME);
        assert!(load(&path).is_empty());

        fs::write(&path, "{ not json").unwrap();
        assert!(load(&path).is_empty());
    }
}
