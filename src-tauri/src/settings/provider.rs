use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager};

use crate::error::Result;

/// Process-wide counter making each settings write use a distinct temp filename, so
/// two concurrent `save_all_settings` calls never stage through the same
/// `…settings.json.tmp` and race on the rename (one writer renames the temp away,
/// the other then fails to rename a file that no longer exists).
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Trait for settings storage to enable testing and abstract the storage mechanism.
pub trait SettingsStoreProvider {
    /// Retrieves all settings from the store as a single JSON `Value`.
    ///
    /// A missing store reads as an empty object (defaults); any other read failure is an
    /// `Err` so callers can distinguish "no settings yet" from "could not read settings".
    fn get_all_settings(&self) -> Result<Value>;
    /// Saves all settings to the store.
    fn save_all_settings(&self, settings: Value) -> Result<()>;
    /// Retrieves the default home directory dynamically based on the OS.
    fn default_home_dir(&self) -> String;
}

/// `SettingsStoreProvider` backed by a plain JSON file in the app data directory.
///
/// Reads/writes `<app_data_dir>/<filename>` directly with `serde_json` + `std::fs`,
/// the same path the former `tauri-plugin-store` used, so existing users' settings
/// files load transparently.
pub struct SettingsFileProvider {
    /// Absolute path to the settings JSON file.
    path: PathBuf,
    /// The OS home directory, used as the default `home_directory` on first launch.
    home_dir: String,
}

impl SettingsFileProvider {
    /// Creates a provider for the given settings filename in the app data directory.
    ///
    /// # Arguments
    ///
    /// * `app` - A handle to the running Tauri application.
    /// * `filename` - The settings file name (e.g. `rook-reader_settings.json`).
    ///
    /// # Returns
    ///
    /// A `SettingsFileProvider` pointing at `<app_data_dir>/<filename>`.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the app data directory cannot be resolved or created.
    pub fn new(app: &AppHandle, filename: &str) -> Result<Self> {
        let dir = crate::setup::app_data_dir(app)?;
        fs::create_dir_all(&dir)?;
        let home_dir = app
            .path()
            .home_dir()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default();
        Ok(Self {
            path: dir.join(filename),
            home_dir,
        })
    }

    /// Builds a temp path next to the settings file that is unique to this write.
    ///
    /// The name embeds the process id and a monotonically increasing counter so
    /// that concurrent `save_all_settings` calls never stage through the same file
    /// and therefore never race on the final rename.
    fn unique_tmp_path(&self) -> PathBuf {
        let n = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        self.path
            .with_extension(format!("json.tmp.{}.{}", std::process::id(), n))
    }
}

impl SettingsStoreProvider for SettingsFileProvider {
    fn get_all_settings(&self) -> Result<Value> {
        let contents = match fs::read_to_string(&self.path) {
            Ok(contents) => contents,
            // Missing file (e.g. first launch) → start from defaults.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(serde_json::json!({})),
            // Any other failure (share lock, permissions) must not look like an empty
            // file: a later save would overwrite the user's real settings with defaults.
            Err(e) => return Err(e.into()),
        };
        Ok(serde_json::from_str(&contents).unwrap_or_else(|e| {
            log::warn!(
                "Failed to parse settings file, using defaults. Error: {}",
                e
            );
            serde_json::json!({})
        }))
    }

    fn save_all_settings(&self, settings: Value) -> Result<()> {
        let json = serde_json::to_string_pretty(&settings)?;
        // Write atomically: write to a per-write unique temp file then rename over
        // the target. The rename keeps a crash mid-write from leaving a truncated
        // settings file; the unique temp name keeps two concurrent writers from
        // colliding on a shared staging path (see `unique_tmp_path`).
        let tmp_path = self.unique_tmp_path();
        fs::write(&tmp_path, json)?;
        if let Err(e) = fs::rename(&tmp_path, &self.path) {
            // Best-effort cleanup so a failed write does not leave a stray temp file.
            let _ = fs::remove_file(&tmp_path);
            return Err(e.into());
        }
        Ok(())
    }

    fn default_home_dir(&self) -> String {
        self.home_dir.clone()
    }
}

/// Process-wide lock serializing the settings file's read-modify-write cycle **and** the
/// dependent runtime apply/broadcast.
///
/// Managed by Tauri as application state. `set_settings` holds it across
/// [`AppSettings::apply_patch`] (persist), the container-runtime apply, and the
/// `settings-changed` broadcast, so two concurrent calls cannot persist A,B but then
/// apply/announce B,A.
///
/// [`AppSettings::apply_patch`]: crate::settings::AppSettings::apply_patch
#[derive(Default)]
pub struct SettingsFileLock(pub tokio::sync::Mutex<()>);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{AppSettings, AppTheme, InitialView};

    /// Builds a `SettingsFileProvider` pointing at the given path (bypasses
    /// `new`, which needs a running Tauri app to resolve the data directory).
    fn provider_at(path: PathBuf) -> SettingsFileProvider {
        SettingsFileProvider {
            path,
            home_dir: "/mock/home".to_string(),
        }
    }

    /// Returns true if a staging temp file (`*.json.tmp.*`) remains in `dir`.
    fn has_temp_file(dir: &std::path::Path) -> bool {
        fs::read_dir(dir).unwrap().any(|entry| {
            entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .contains(".json.tmp.")
        })
    }

    #[test]
    fn file_provider_save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let provider = provider_at(dir.path().join("settings.json"));

        let mut original = AppSettings::default();
        original.reader.comic.loupe.zoom = 3.0;
        original.reader.novel.font_size = 18.5;
        original.bookshelf.grid_size = 2;
        original.save(&provider).unwrap();

        let loaded = AppSettings::load(&provider).unwrap();
        assert_eq!(loaded.reader.comic.loupe.zoom, 3.0);
        assert_eq!(loaded.reader.novel.font_size, 18.5);
        assert_eq!(loaded.bookshelf.grid_size, 2);
    }

    #[test]
    fn file_provider_migrates_legacy_plugin_file_and_fills_defaults() {
        // A file shaped like the old `tauri-plugin-store` output: a JSON object
        // keyed by the top-level settings categories, with only some fields set.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(
            &path,
            r#"{"general":{"theme":"dark"},"bookshelf":{"gridSize":2}}"#,
        )
        .unwrap();

        let loaded = AppSettings::load(&provider_at(path)).unwrap();

        assert!(matches!(loaded.general.theme, AppTheme::Dark));
        assert_eq!(loaded.bookshelf.grid_size, 2);
        // Omitted fields fall back to defaults.
        assert_eq!(loaded.reader.rendering.pdf_render_resolution_height, 2000);
        assert!(matches!(loaded.startup.initial_view, InitialView::Reader));
    }

    #[test]
    fn file_provider_read_error_other_than_not_found_propagates() {
        // A path that exists but is a directory: reading it fails with a kind other than
        // NotFound. It must propagate as Err rather than read as "empty" — otherwise a
        // later save would overwrite the user's real settings with defaults.
        let dir = tempfile::tempdir().unwrap();
        let settings_as_dir = dir.path().join("settings.json");
        fs::create_dir(&settings_as_dir).unwrap();
        let provider = provider_at(settings_as_dir);

        assert!(provider.get_all_settings().is_err());
    }

    #[test]
    fn file_provider_missing_file_yields_defaults_with_home_dir() {
        let dir = tempfile::tempdir().unwrap();
        let provider = provider_at(dir.path().join("does_not_exist.json"));

        let loaded = AppSettings::load(&provider).unwrap();

        assert!(matches!(loaded.general.theme, AppTheme::System));
        assert_eq!(
            loaded.file_navigator.home_directory.to_str().unwrap(),
            "/mock/home"
        );
    }

    #[test]
    fn file_provider_malformed_json_yields_defaults_without_panicking() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, "{ this is not valid json ]").unwrap();

        let loaded = AppSettings::load(&provider_at(path)).unwrap();

        assert!(matches!(loaded.general.theme, AppTheme::System));
    }

    #[test]
    fn file_provider_save_is_atomic_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let provider = provider_at(path.clone());

        AppSettings::default().save(&provider).unwrap();

        // The written file parses back into AppSettings.
        let contents = fs::read_to_string(&path).unwrap();
        let _: AppSettings = serde_json::from_str(&contents).unwrap();
        // No leftover temp file remains after the atomic rename.
        assert!(!has_temp_file(dir.path()));
    }

    #[test]
    fn file_provider_unique_tmp_path_differs_and_sits_beside_target() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("settings.json");
        let provider = provider_at(target.clone());

        let a = provider.unique_tmp_path();
        let b = provider.unique_tmp_path();

        assert_ne!(a, b, "consecutive temp paths must be distinct");
        assert_eq!(a.parent(), target.parent());
        assert_eq!(b.parent(), target.parent());
    }

    #[test]
    fn file_provider_concurrent_saves_all_succeed_and_leave_no_temp_files() {
        // With a shared fixed temp filename this races: one writer renames the temp
        // away and another's rename fails. A unique-per-write temp name removes the
        // collision, so every concurrent save must succeed and clean up after itself.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let provider = std::sync::Arc::new(provider_at(path.clone()));

        let handles: Vec<_> = (0..8)
            .map(|_| {
                let provider = std::sync::Arc::clone(&provider);
                std::thread::spawn(move || AppSettings::default().save(provider.as_ref()))
            })
            .collect();

        for handle in handles {
            handle
                .join()
                .unwrap()
                .expect("concurrent save should succeed");
        }

        let contents = fs::read_to_string(&path).unwrap();
        let _: AppSettings = serde_json::from_str(&contents).unwrap();
        assert!(!has_temp_file(dir.path()));
    }
}
