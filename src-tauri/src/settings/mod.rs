mod model;
mod patch;
mod provider;
mod validation;

pub use model::*;
pub use patch::SettingsPatch;
pub use provider::{SettingsFileLock, SettingsFileProvider, SettingsStoreProvider};

use std::fmt;
use std::path::PathBuf;

use garde::Validate;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{Error, Result};
use patch::json_deep_merge;
use validation::{collect_violations, json_leaf, set_json_leaf, snake_to_camel_case};

/// A single settings field that failed validation, structured so the frontend can
/// render a localized, actionable message ("out of range" vs "must be a whole number")
/// pointing at the exact field and showing its valid bounds.
///
/// Carried by [`Error::SettingsValidation`](crate::error::Error::SettingsValidation) and
/// serialized into the command error's `details` array.
#[derive(Debug, Clone, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SettingsValidationViolation {
    /// The camelCase dotted path of the offending field, e.g.
    /// `"reader.rendering.maxImageHeight"`. Matches the keys the frontend dispatches.
    pub path: String,
    /// What is wrong with the value.
    pub kind: ViolationKind,
    /// The inclusive minimum valid value (always populated so the UI can show the range).
    pub min: f64,
    /// The inclusive maximum valid value.
    pub max: f64,
}

/// The category of a [`SettingsValidationViolation`].
#[derive(Debug, Clone, Copy, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ViolationKind {
    /// The value is below `min` or above `max`.
    OutOfRange,
    /// An integer field received a value with a fractional part.
    NotInteger,
    /// The value is missing, not a number, or non-finite.
    NotANumber,
}

/// Represents the root configuration of the application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    /// General application settings, including theming and fonts.
    #[garde(dive)]
    pub general: GeneralSettings,
    /// Settings related to the application's startup behavior.
    #[garde(dive)]
    pub startup: StartupSettings,
    /// Settings specific to the bookshelf (library) view.
    #[garde(dive)]
    pub bookshelf: BookshelfSettings,
    /// Settings for the file navigator and directory management.
    #[garde(dive)]
    pub file_navigator: FileNavigatorSettings,
    /// Settings for reading content (both comics and novels).
    #[garde(dive)]
    pub reader: ReaderSettings,
    /// Settings related to user history and tracking.
    #[garde(dive)]
    pub history: HistorySettings,
    /// Settings related to the application's layout.
    #[garde(dive)]
    pub layout: LayoutSettings,
}

impl AppSettings {
    /// Loads and normalizes the application settings from the provider.
    ///
    /// This is a **pure read**: it deserializes the stored value (falling back to
    /// defaults on parse failure), fills the dynamic home directory, and repairs any
    /// out-of-range fields in memory. It never writes back.
    ///
    /// # Arguments
    ///
    /// * `provider` - The storage backend to read from.
    ///
    /// # Returns
    ///
    /// The normalized, valid settings.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the provider fails to read the store (other than a missing
    /// file, which reads as defaults).
    pub fn load<P: SettingsStoreProvider>(provider: &P) -> Result<Self> {
        Ok(Self::normalize(
            provider.get_all_settings()?,
            provider.default_home_dir(),
        ))
    }

    /// Persists the settings through the provider.
    ///
    /// # Arguments
    ///
    /// * `provider` - The storage backend to write to.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if serialization or the provider write fails.
    pub fn save<P: SettingsStoreProvider>(&self, provider: &P) -> Result<()> {
        provider.save_all_settings(serde_json::to_value(self)?)
    }

    /// Loads, normalizes, and persists the settings back **only when** normalization
    /// changed the stored document.
    ///
    /// This is the single place a "read" may write, and is intended to be called once
    /// at startup so a stale or out-of-range file is healed on disk.
    ///
    /// # Arguments
    ///
    /// * `provider` - The storage backend.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if serialization or the provider write fails.
    pub fn load_and_persist_normalized<P: SettingsStoreProvider>(provider: &P) -> Result<Self> {
        let raw = match provider.get_all_settings() {
            Ok(raw) => raw,
            // An unreadable file (share lock, permissions) must not be healed: writing
            // defaults back would clobber the user's real settings. Run with in-memory
            // defaults and leave the file untouched so it can recover on the next launch.
            Err(e) => {
                log::error!(
                    "Settings file unreadable; running with defaults without persisting: {e}"
                );
                return Ok(Self::normalize(
                    serde_json::json!({}),
                    provider.default_home_dir(),
                ));
            }
        };
        let config = Self::normalize(raw.clone(), provider.default_home_dir());
        if serde_json::to_value(&config)? != raw {
            config.save(provider)?;
        }
        Ok(config)
    }

    /// Read-modify-write: deep-merges `patch` into the current settings, validates the
    /// merged whole, persists it, and returns it.
    ///
    /// This is **not** self-synchronizing: the caller must hold the `SettingsFileLock`
    /// across this call and any dependent runtime apply/broadcast, so two concurrent
    /// writers cannot persist A,B but then apply/announce B,A. Out-of-range merged
    /// results are rejected **without** persisting (repair is only applied when *loading*
    /// a pre-existing file, never on writes).
    ///
    /// # Arguments
    ///
    /// * `provider` - The storage backend.
    /// * `patch` - The single-category partial change to apply.
    ///
    /// # Returns
    ///
    /// The full merged settings on success.
    ///
    /// # Errors
    ///
    /// Returns `Error::Settings` if the patch produces an undeserializable or
    /// out-of-range result, or a serialization/write error from the provider.
    pub fn apply_patch<P: SettingsStoreProvider>(
        provider: &P,
        patch: SettingsPatch,
    ) -> Result<Self> {
        // load() normalizes + repairs, so the merge base is always valid.
        let current = Self::load(provider)?;
        let mut merged_json = serde_json::to_value(&current)?;
        json_deep_merge(&mut merged_json, patch.into_object());
        // Produce structured, field-specific violations (kind + valid bounds) for the UI
        // before deserializing, so a decimal in an integer field is reported as a
        // `NotInteger` with its path rather than an opaque serde error.
        let violations = collect_violations(&merged_json);
        if !violations.is_empty() {
            return Err(Error::SettingsValidation(violations));
        }
        let merged: Self = serde_json::from_value(merged_json)
            .map_err(|e| Error::Settings(format!("Invalid settings patch: {e}")))?;
        // `garde` stays the authoritative gate: anything `collect_violations` missed
        // (e.g. a non-numeric constraint) still cannot be persisted.
        merged
            .validate()
            .map_err(|r| Error::Settings(format!("Settings validation failed: {r}")))?;
        merged.save(provider)?;
        Ok(merged)
    }

    /// Deserializes the raw value, fills the dynamic home directory, and repairs
    /// out-of-range fields. Never writes.
    fn normalize(raw: Value, default_home_dir: String) -> Self {
        let mut config = Self::deserialize_tolerant(raw);

        // Dynamically set the default home directory if it's empty (e.g., on first launch).
        if config.file_navigator.home_directory.as_os_str().is_empty() {
            config.file_navigator.home_directory = PathBuf::from(default_home_dir);
        }

        config.repair_invalid_fields();
        config
    }

    /// Deserializes `raw` into `AppSettings`, healing individual corrupt leaves
    /// (wrong type, unknown enum variant) by resetting only those leaves to their
    /// default — never discarding the whole document.
    ///
    /// A single bad field (e.g. an enum variant renamed across versions) would
    /// otherwise fail the whole `from_value` and collapse every setting to defaults.
    fn deserialize_tolerant(raw: Value) -> Self {
        // Start from a full default document so every key exists and every custom
        // default (e.g. `enableSpread = true`) is represented, then overlay stored values.
        let default_value = match serde_json::to_value(AppSettings::default()) {
            Ok(v) => v,
            Err(e) => {
                log::error!("settings: serialize defaults failed: {e}");
                return AppSettings::default();
            }
        };
        let mut merged = default_value.clone();
        json_deep_merge(&mut merged, raw);

        // Deserialize; on each field-level failure reset that one leaf to its default
        // and retry. Bounded by the number of corrupt leaves.
        loop {
            match serde_path_to_error::deserialize::<_, AppSettings>(&merged) {
                Ok(config) => return config,
                Err(err) => {
                    let path = err.path().to_string();
                    let segments: Vec<String> = path.split('.').map(str::to_string).collect();
                    let reset = !path.is_empty()
                        && json_leaf(&default_value, &segments)
                            .cloned()
                            .map(|def| set_json_leaf(&mut merged, &segments, def))
                            .unwrap_or(false);
                    if !reset {
                        log::warn!(
                            "settings: parse failure could not be localized ({err}); using defaults"
                        );
                        return AppSettings::default();
                    }
                    log::warn!(
                        "settings: resetting unparseable field '{path}' to default. Reason: {err}"
                    );
                }
            }
        }
    }

    /// Resets any field violating a `garde` bound to its default value.
    ///
    /// This is generic: it reacts to the validation report rather than hard-coding
    /// per-field arms, so a newly added bound is repaired with no extra code. One pass
    /// suffices because every default leaf is itself valid.
    fn repair_invalid_fields(&mut self) {
        let Err(report) = self.validate() else {
            return;
        };
        let defaults = match serde_json::to_value(AppSettings::default()) {
            Ok(v) => v,
            Err(e) => {
                log::error!("repair: serialize defaults failed: {e}");
                return;
            }
        };
        let mut current = match serde_json::to_value(&*self) {
            Ok(v) => v,
            Err(e) => {
                log::error!("repair: serialize settings failed: {e}");
                return;
            }
        };
        for (path, error) in report.iter() {
            let path = path.to_string();
            log::warn!("Resetting out-of-range setting '{path}' to default. Reason: {error}");
            let segments: Vec<String> = path.split('.').map(snake_to_camel_case).collect();
            match json_leaf(&defaults, &segments) {
                Some(def) => {
                    let def = def.clone();
                    if !set_json_leaf(&mut current, &segments, def) {
                        log::warn!("repair: could not locate '{path}' in document");
                    }
                }
                None => log::warn!("repair: no default for '{path}'; leaving unchanged"),
            }
        }
        match serde_json::from_value::<AppSettings>(current) {
            Ok(repaired) => *self = repaired,
            Err(e) => log::error!("repair: deserialize repaired settings failed: {e}"),
        }
    }
}

impl fmt::Display for AppSettings {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match serde_json::to_string_pretty(self) {
            Ok(pretty_json) => write!(f, "AppConfig {}", pretty_json),
            Err(e) => write!(f, "[AppConfig Serialization Error: {}]", e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    /// A full, valid document with a non-empty home directory, so `normalize` makes no
    /// changes (a stable baseline for the persist-on-change and apply-patch tests).
    fn default_doc_with_home() -> Value {
        let mut settings = AppSettings::default();
        settings.file_navigator.home_directory = PathBuf::from("/mock/home");
        serde_json::to_value(&settings).unwrap()
    }

    struct MockProvider {
        mock_json: Value,
    }

    impl SettingsStoreProvider for MockProvider {
        fn get_all_settings(&self) -> Result<Value> {
            Ok(self.mock_json.clone())
        }
        fn save_all_settings(&self, _settings: Value) -> Result<()> {
            Ok(())
        }
        fn default_home_dir(&self) -> String {
            "/mock/home".to_string()
        }
    }

    /// A stateful provider that counts writes and reflects the last saved value on
    /// subsequent reads. Used to assert read purity and the persist-on-change policy.
    struct RecordingProvider {
        initial: Value,
        saves: AtomicUsize,
        last_saved: Mutex<Option<Value>>,
    }

    impl RecordingProvider {
        fn new(initial: Value) -> Self {
            Self {
                initial,
                saves: AtomicUsize::new(0),
                last_saved: Mutex::new(None),
            }
        }
        fn save_count(&self) -> usize {
            self.saves.load(Ordering::SeqCst)
        }
        fn last_saved(&self) -> Option<Value> {
            self.last_saved.lock().unwrap().clone()
        }
    }

    impl SettingsStoreProvider for RecordingProvider {
        fn get_all_settings(&self) -> Result<Value> {
            Ok(self
                .last_saved
                .lock()
                .unwrap()
                .clone()
                .unwrap_or_else(|| self.initial.clone()))
        }
        fn save_all_settings(&self, settings: Value) -> Result<()> {
            self.saves.fetch_add(1, Ordering::SeqCst);
            *self.last_saved.lock().unwrap() = Some(settings);
            Ok(())
        }
        fn default_home_dir(&self) -> String {
            "/mock/home".to_string()
        }
    }

    #[test]
    fn test_load_default_settings() {
        let provider = MockProvider {
            mock_json: json!({}),
        };
        let settings = AppSettings::load(&provider).unwrap();

        // Check dynamically assigned default
        assert_eq!(
            settings.file_navigator.home_directory.to_str().unwrap(),
            "/mock/home"
        );
        // Check static defaults
        assert!(matches!(settings.general.theme, AppTheme::System));
        assert_eq!(
            settings.general.app_font_family,
            "Inter, Avenir, Helvetica, Arial, sans-serif"
        );
        assert!(settings.startup.check_update_on_startup);
        assert!(settings.reader.comic.enable_spread);
        assert_eq!(settings.reader.comic.loupe.zoom, 2.0);
        assert_eq!(settings.reader.comic.loupe.radius, 200.0);
        assert_eq!(settings.reader.comic.loupe.toggle_key, "MouseMiddle");
        assert_eq!(settings.reader.novel.font_family, "default-font");
        assert_eq!(settings.reader.novel.font_size, 16.0);
        assert_eq!(settings.reader.rendering.pdf_render_resolution_height, 2000);
        assert!(matches!(
            settings.reader.auto_open_adjacent_book,
            AutoOpenAdjacentBookMode::Ask
        ));
    }

    #[test]
    fn test_load_partial_settings() {
        let provider = MockProvider {
            mock_json: json!({
                "general": { "theme": "dark" },
                "startup": { "checkUpdateOnStartup": false },
                "reader": { "comic": { "enableSpread": false, "loupe": { "zoom": 3.0, "toggleKey": "Alt+l" } }, "autoOpenAdjacentBook": "ask" },
                "layout": { "sidePane": { "isHidden": true, "tabIndex": 2 } }
            }),
        };
        let settings = AppSettings::load(&provider).unwrap();

        // Provided values should be parsed correctly
        assert!(matches!(settings.general.theme, AppTheme::Dark));
        assert!(!settings.startup.check_update_on_startup);
        assert!(!settings.reader.comic.enable_spread);
        assert_eq!(settings.reader.comic.loupe.zoom, 3.0);
        assert_eq!(settings.reader.comic.loupe.toggle_key, "Alt+l");
        assert!(matches!(
            settings.reader.auto_open_adjacent_book,
            AutoOpenAdjacentBookMode::Ask
        ));
        assert!(settings.layout.side_pane.is_hidden);
        assert_eq!(settings.layout.side_pane.tab_index, 2);

        // Omitted values should fall back to defaults safely
        assert!(matches!(settings.startup.initial_view, InitialView::Reader));
        assert!(settings.startup.restore_last_book);
        assert_eq!(settings.reader.comic.loupe.radius, 200.0);
        assert_eq!(settings.reader.rendering.pdf_render_resolution_height, 2000);
    }

    // ---- deserialize_tolerant (field-level healing) ----

    #[test]
    fn normalize_heals_single_bad_enum_and_keeps_siblings() {
        let mut doc = default_doc_with_home();
        doc["general"]["theme"] = json!("neon"); // invalid enum variant
        doc["general"]["appFontFamily"] = json!("My Font"); // healthy sibling
        let cfg = AppSettings::normalize(doc, "/mock/home".into());
        assert!(matches!(cfg.general.theme, AppTheme::System)); // reset to default
        assert_eq!(cfg.general.app_font_family, "My Font"); // preserved
    }

    #[test]
    fn normalize_heals_wrong_typed_leaf_and_keeps_siblings() {
        let mut doc = default_doc_with_home();
        doc["reader"]["novel"]["fontSize"] = json!("big"); // wrong type
        doc["reader"]["comic"]["enableSpread"] = json!(false);
        let cfg = AppSettings::normalize(doc, "/mock/home".into());
        assert_eq!(cfg.reader.novel.font_size, 16.0); // default restored
        assert!(!cfg.reader.comic.enable_spread); // preserved
    }

    // ---- repair_invalid_fields ----

    #[test]
    fn test_repair_resets_all_out_of_range_fields() {
        let mut s = AppSettings::default();
        s.bookshelf.grid_size = 9;
        s.reader.comic.cache.preload_page_count = -5;
        s.reader.comic.cache.image_cache_size_mib = 0;
        s.reader.comic.loupe.zoom = 999.0;
        s.reader.comic.loupe.radius = 0.0;
        s.reader.novel.font_size = 0.0;
        s.reader.rendering.max_image_height = -1;
        s.reader.rendering.pdf_render_resolution_height = 0;
        s.layout.side_pane.tab_index = 9999;

        s.repair_invalid_fields();

        assert!(s.validate().is_ok());
        let defaults = AppSettings::default();
        assert_eq!(s.bookshelf.grid_size, defaults.bookshelf.grid_size);
        assert_eq!(
            s.reader.comic.cache.preload_page_count,
            defaults.reader.comic.cache.preload_page_count
        );
        assert_eq!(s.reader.comic.loupe.zoom, defaults.reader.comic.loupe.zoom);
        assert_eq!(s.reader.novel.font_size, defaults.reader.novel.font_size);
        assert_eq!(
            s.layout.side_pane.tab_index,
            defaults.layout.side_pane.tab_index
        );
    }

    #[test]
    fn test_repair_keeps_valid_siblings() {
        let mut s = AppSettings::default();
        s.reader.comic.loupe.toggle_key = "Alt+z".to_string();
        s.reader.comic.enable_spread = false;
        s.reader.rendering.max_image_height = -1; // only this is invalid

        s.repair_invalid_fields();

        assert!(s.validate().is_ok());
        assert_eq!(s.reader.rendering.max_image_height, 0); // repaired
        assert_eq!(s.reader.comic.loupe.toggle_key, "Alt+z"); // preserved
        assert!(!s.reader.comic.enable_spread); // preserved
    }

    // ---- load purity ----

    #[rstest::rstest]
    #[case(json!({}))]
    #[case(json!({ "general": { "theme": "dark" } }))]
    #[case(json!({ "reader": { "rendering": { "maxImageHeight": -10 } } }))]
    #[case(json!("not an object"))]
    fn test_load_is_pure(#[case] raw: Value) {
        let provider = RecordingProvider::new(raw);
        let _ = AppSettings::load(&provider).unwrap();
        assert_eq!(provider.save_count(), 0, "load must not write");
    }

    // ---- load_and_persist_normalized policy ----

    #[test]
    fn test_persist_normalized_no_write_when_unchanged() {
        let provider = RecordingProvider::new(default_doc_with_home());
        AppSettings::load_and_persist_normalized(&provider).unwrap();
        assert_eq!(provider.save_count(), 0);
    }

    #[test]
    fn test_persist_normalized_writes_repaired_doc_once() {
        let mut doc = default_doc_with_home();
        doc["reader"]["rendering"]["maxImageHeight"] = json!(-1);
        let provider = RecordingProvider::new(doc);

        AppSettings::load_and_persist_normalized(&provider).unwrap();

        assert_eq!(provider.save_count(), 1);
        let saved = provider.last_saved().unwrap();
        assert_eq!(saved["reader"]["rendering"]["maxImageHeight"], 0);
    }

    #[test]
    fn test_persist_normalized_writes_partial_once() {
        let provider = RecordingProvider::new(json!({ "general": { "theme": "dark" } }));
        AppSettings::load_and_persist_normalized(&provider).unwrap();
        assert_eq!(provider.save_count(), 1);
    }

    #[test]
    fn test_persist_normalized_exact_f64_does_not_rewrite() {
        let mut doc = default_doc_with_home();
        doc["reader"]["comic"]["loupe"]["zoom"] = json!(3.0);
        let provider = RecordingProvider::new(doc);
        AppSettings::load_and_persist_normalized(&provider).unwrap();
        assert_eq!(provider.save_count(), 0);
    }

    /// A provider whose reads always fail (e.g. an exclusively-locked settings file),
    /// recording whether `save` was ever called.
    struct FailingReadProvider {
        saves: AtomicUsize,
    }

    impl SettingsStoreProvider for FailingReadProvider {
        fn get_all_settings(&self) -> Result<Value> {
            Err(Error::Settings("read failed".to_string()))
        }
        fn save_all_settings(&self, _settings: Value) -> Result<()> {
            self.saves.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
        fn default_home_dir(&self) -> String {
            "/mock/home".to_string()
        }
    }

    #[test]
    fn test_persist_normalized_unreadable_file_uses_defaults_without_saving() {
        let provider = FailingReadProvider {
            saves: AtomicUsize::new(0),
        };

        let settings = AppSettings::load_and_persist_normalized(&provider).unwrap();

        // Runs with in-memory defaults...
        assert!(matches!(settings.general.theme, AppTheme::System));
        // ...and must never persist, which would clobber the real file with defaults.
        assert_eq!(provider.saves.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn test_save_load_round_trip() {
        let provider = RecordingProvider::new(json!({}));
        let mut settings = AppSettings::default();
        settings.file_navigator.home_directory = PathBuf::from("/mock/home");
        settings.reader.novel.font_size = 18.5;
        settings.save(&provider).unwrap();

        let loaded = AppSettings::load(&provider).unwrap();
        assert_eq!(loaded.reader.novel.font_size, 18.5);
        assert_eq!(
            loaded.file_navigator.home_directory,
            PathBuf::from("/mock/home")
        );
    }

    // ---- apply_patch ----

    #[test]
    fn test_apply_patch_preserves_same_category_siblings() {
        let provider = RecordingProvider::new(default_doc_with_home());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 500 } }));

        let merged = AppSettings::apply_patch(&provider, patch).unwrap();

        assert_eq!(merged.reader.rendering.max_image_height, 500);
        // Sibling leaf of the same coarse category is preserved.
        assert!(merged.reader.comic.enable_spread);
        assert_eq!(provider.save_count(), 1);
    }

    #[test]
    fn test_apply_patch_rejects_out_of_range_without_persisting() {
        let provider = RecordingProvider::new(default_doc_with_home());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 70000 } }));

        let result = AppSettings::apply_patch(&provider, patch);

        assert!(result.is_err());
        assert_eq!(provider.save_count(), 0);
    }

    #[test]
    fn test_apply_patch_sequential_accumulates() {
        let provider = RecordingProvider::new(default_doc_with_home());

        AppSettings::apply_patch(
            &provider,
            SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 500 } })),
        )
        .unwrap();
        let merged = AppSettings::apply_patch(
            &provider,
            SettingsPatch::Bookshelf(json!({ "gridSize": 2 })),
        )
        .unwrap();

        // The second read-modify-write sees the first write's result.
        assert_eq!(merged.reader.rendering.max_image_height, 500);
        assert_eq!(merged.bookshelf.grid_size, 2);
    }

    #[test]
    fn test_apply_patch_returns_structured_validation_error() {
        let provider = RecordingProvider::new(default_doc_with_home());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 70000 } }));

        let err = AppSettings::apply_patch(&provider, patch)
            .expect_err("out-of-range patch should be rejected");

        match err {
            Error::SettingsValidation(violations) => {
                assert_eq!(violations.len(), 1);
                assert_eq!(violations[0].path, "reader.rendering.maxImageHeight");
                assert_eq!(violations[0].kind, ViolationKind::OutOfRange);
                assert_eq!(violations[0].min, 0.0);
                assert_eq!(violations[0].max, 65535.0);
            }
            other => panic!("expected SettingsValidation, got {other:?}"),
        }
        assert_eq!(provider.save_count(), 0);
    }
}
