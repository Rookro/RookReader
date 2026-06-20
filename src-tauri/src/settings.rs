use garde::Validate;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::{collections::HashMap, fmt};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::error::{Error, Result};

/// Trait for settings storage to enable testing and abstract the storage mechanism.
pub trait SettingsStoreProvider {
    /// Retrieves all settings from the store as a single JSON `Value`.
    fn get_all_settings(&self) -> Value;
    /// Saves all settings to the store.
    fn save_all_settings(&self, settings: Value) -> Result<()>;
    /// Retrieves the default home directory dynamically based on the OS.
    fn default_home_dir(&self) -> String;
}

/// Real implementation of `SettingsStoreProvider` using `tauri-plugin-store`.
///
/// This is the persistence backend used until the plain-`serde_json` file provider
/// replaces it. It holds an owned `AppHandle` so it can be constructed both from the
/// startup `App` and from command handlers.
pub struct TauriStoreProvider {
    app: AppHandle,
    filename: String,
}

impl TauriStoreProvider {
    /// Creates a provider bound to the given store `filename`.
    pub fn new(app: &AppHandle, filename: &str) -> Self {
        Self {
            app: app.clone(),
            filename: filename.to_string(),
        }
    }
}

impl SettingsStoreProvider for TauriStoreProvider {
    fn get_all_settings(&self) -> Value {
        if let Ok(store) = self.app.store(&self.filename) {
            let mut map = serde_json::Map::new();
            for (key, value) in store.entries() {
                map.insert(key.clone(), value.clone());
            }
            return Value::Object(map);
        }
        serde_json::json!({})
    }

    fn save_all_settings(&self, settings: Value) -> Result<()> {
        if let Ok(store) = self.app.store(&self.filename) {
            if let Value::Object(map) = settings {
                for (key, value) in map {
                    store.set(key, value);
                }
                store
                    .save()
                    .map_err(|e| Error::Settings(format!("Failed to save settings: {}", e)))?;
            }
        }
        Ok(())
    }

    fn default_home_dir(&self) -> String {
        self.app
            .path()
            .home_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    }
}

/// Process-wide lock serializing the settings file's read-modify-write cycle.
///
/// Managed by Tauri as application state and passed to [`AppSettings::apply_patch_serialized`]
/// so concurrent `set_settings` calls cannot interleave their load/merge/save steps.
#[derive(Default)]
pub struct SettingsFileLock(pub tokio::sync::Mutex<()>);

/// A single-category settings change.
///
/// The variant names the top-level category; the payload is a *partial* of that
/// category (only the changed leaves), expressed as a raw JSON `Value`. The backend
/// deep-merges this partial into the current settings, so untouched sibling leaves
/// are preserved. The patch is deserialize-only; it is never serialized back.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingsPatch {
    /// A partial update to [`GeneralSettings`].
    General(Value),
    /// A partial update to [`StartupSettings`].
    Startup(Value),
    /// A partial update to [`BookshelfSettings`].
    Bookshelf(Value),
    /// A partial update to [`FileNavigatorSettings`].
    FileNavigator(Value),
    /// A partial update to [`ReaderSettings`].
    Reader(Value),
    /// A partial update to [`HistorySettings`].
    History(Value),
    /// A partial update to [`LayoutSettings`].
    Layout(Value),
}

impl SettingsPatch {
    /// Wraps the partial as `{ "<categoryCamelKey>": <partial> }`, matching the
    /// serde camelCase document so the deep merge targets only that category.
    fn into_object(self) -> Value {
        let (key, value) = match self {
            SettingsPatch::General(v) => ("general", v),
            SettingsPatch::Startup(v) => ("startup", v),
            SettingsPatch::Bookshelf(v) => ("bookshelf", v),
            SettingsPatch::FileNavigator(v) => ("fileNavigator", v),
            SettingsPatch::Reader(v) => ("reader", v),
            SettingsPatch::History(v) => ("history", v),
            SettingsPatch::Layout(v) => ("layout", v),
        };
        serde_json::json!({ key: value })
    }
}

/// Recursively merges `patch` into `target`.
///
/// Objects merge key-by-key; any non-object value (or a key new to `target`)
/// overwrites/inserts. Used to fold a partial leaf patch into the current settings
/// while preserving untouched siblings.
fn json_deep_merge(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(t), Value::Object(p)) => {
            for (k, pv) in p {
                json_deep_merge(t.entry(k).or_insert(Value::Null), pv);
            }
        }
        (slot, pv) => *slot = pv,
    }
}

/// `garde` custom validator rejecting non-finite floats.
///
/// `garde`'s `range` validator does not reject `NaN` (all comparisons against `NaN`
/// are false, so it passes the min/max check), so this guard is paired with `range`
/// on every float field to keep `NaN`/infinity out of the settings.
fn finite_f64(value: &f64, _ctx: &()) -> garde::Result {
    if value.is_finite() {
        Ok(())
    } else {
        Err(garde::Error::new("must be a finite number"))
    }
}

/// Converts a snake_case segment to camelCase.
///
/// `garde` reports Rust field names (snake_case) while the serialized document uses
/// serde camelCase, so report paths must be translated before navigating the JSON.
fn snake_to_camel_case(segment: &str) -> String {
    let mut out = String::with_capacity(segment.len());
    let mut up = false;
    for c in segment.chars() {
        if c == '_' {
            up = true;
        } else if up {
            out.extend(c.to_uppercase());
            up = false;
        } else {
            out.push(c);
        }
    }
    out
}

/// Navigates `value` along `segments`, returning the addressed leaf if present.
fn json_leaf<'a>(value: &'a Value, segments: &[String]) -> Option<&'a Value> {
    let mut cur = value;
    for s in segments {
        cur = cur.get(s.as_str())?;
    }
    Some(cur)
}

/// Replaces the leaf addressed by `segments` in `value` with `new_value`.
///
/// Returns `true` if the leaf existed and was replaced, `false` otherwise.
fn set_json_leaf(value: &mut Value, segments: &[String], new_value: Value) -> bool {
    let Some((last, parents)) = segments.split_last() else {
        return false;
    };
    let mut cur = value;
    for s in parents {
        let Some(next) = cur.get_mut(s.as_str()) else {
            return false;
        };
        cur = next;
    }
    match cur.get_mut(last.as_str()) {
        Some(slot) => {
            *slot = new_value;
            true
        }
        None => false,
    }
}

/// Represents the root configuration of the application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate)]
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
    /// Currently infallible in practice, but returns `Result` to keep the read API
    /// symmetric with [`AppSettings::save`] and tolerant of future fallible providers.
    pub fn load<P: SettingsStoreProvider>(provider: &P) -> Result<Self> {
        Ok(Self::normalize(
            provider.get_all_settings(),
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
        let raw = provider.get_all_settings();
        let config = Self::normalize(raw.clone(), provider.default_home_dir());
        if serde_json::to_value(&config)? != raw {
            config.save(provider)?;
        }
        Ok(config)
    }

    /// Serialized read-modify-write: deep-merges `patch` into the current settings,
    /// validates the merged whole, persists it, and returns it.
    ///
    /// The whole cycle is serialized on `lock` so concurrent writers cannot interleave.
    /// Out-of-range merged results are rejected **without** persisting (repair is only
    /// applied when *loading* a pre-existing file, never on writes).
    ///
    /// # Arguments
    ///
    /// * `provider` - The storage backend.
    /// * `lock` - The process-wide settings file lock.
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
    pub async fn apply_patch_serialized<P: SettingsStoreProvider>(
        provider: &P,
        lock: &tokio::sync::Mutex<()>,
        patch: SettingsPatch,
    ) -> Result<Self> {
        let _guard = lock.lock().await;
        // load() normalizes + repairs, so the merge base is always valid.
        let current = Self::load(provider)?;
        let mut merged_json = serde_json::to_value(&current)?;
        json_deep_merge(&mut merged_json, patch.into_object());
        let merged: Self = serde_json::from_value(merged_json)
            .map_err(|e| Error::Settings(format!("Invalid settings patch: {e}")))?;
        merged
            .validate()
            .map_err(|r| Error::Settings(format!("Settings validation failed: {r}")))?;
        merged.save(provider)?;
        Ok(merged)
    }

    /// Deserializes the raw value, fills the dynamic home directory, and repairs
    /// out-of-range fields. Never writes.
    fn normalize(raw: Value, default_home_dir: String) -> Self {
        let mut config: AppSettings = serde_json::from_value(raw).unwrap_or_else(|e| {
            log::warn!("Failed to parse settings, using default. Error: {e}");
            AppSettings::default()
        });

        // Dynamically set the default home directory if it's empty (e.g., on first launch).
        if config.file_navigator.home_directory.as_os_str().is_empty() {
            config.file_navigator.home_directory = PathBuf::from(default_home_dir);
        }

        config.repair_invalid_fields();
        config
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

/// General application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct GeneralSettings {
    /// The application's color theme.
    #[garde(skip)]
    pub theme: AppTheme,
    /// The font family used for the application's UI.
    #[garde(skip)]
    #[serde(default = "default_app_font_family")]
    pub app_font_family: String,
    /// Configuration for application logging.
    #[garde(dive)]
    pub log: LogSettings,
    /// A flexible map for toggling or configuring experimental features.
    #[garde(skip)]
    pub experimental_features: HashMap<String, serde_json::Value>,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            theme: AppTheme::default(),
            app_font_family: default_app_font_family(),
            log: LogSettings::default(),
            experimental_features: HashMap::new(),
        }
    }
}

fn default_app_font_family() -> String {
    "Inter, Avenir, Helvetica, Arial, sans-serif".to_string()
}

/// Configuration for application logging.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct LogSettings {
    /// The minimum severity level to log.
    #[garde(skip)]
    pub level: LogLevel,
}

/// Settings related to the application's startup behavior.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct StartupSettings {
    /// The initial view presented to the user upon launch.
    #[garde(skip)]
    pub initial_view: InitialView,
    /// Whether to automatically restore the last opened book/container on startup.
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub restore_last_book: bool,
    /// Whether to automatically check for updates on startup.
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub check_update_on_startup: bool,
}

impl Default for StartupSettings {
    fn default() -> Self {
        Self {
            initial_view: InitialView::default(),
            restore_last_book: default_true(),
            check_update_on_startup: default_true(),
        }
    }
}

/// Settings specific to the bookshelf view.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct BookshelfSettings {
    /// The criteria used to sort items in the bookshelf.
    #[garde(skip)]
    pub sort_order: SortOrder,
    /// The number of size to display in the bookshelf grid (index into a small/medium/large table).
    #[garde(range(max = 2))]
    pub grid_size: u8,
    /// Whether to enable automatic horizontal scrolling for overflowing text.
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub enable_auto_scroll: bool,
}

impl Default for BookshelfSettings {
    fn default() -> Self {
        Self {
            sort_order: SortOrder::default(),
            grid_size: 1,
            enable_auto_scroll: default_true(),
        }
    }
}

/// Settings for the file navigator.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct FileNavigatorSettings {
    /// The default directory opened when clicking the Home button.
    #[garde(skip)]
    pub home_directory: PathBuf,
    /// The criteria used to sort files and directories.
    #[garde(skip)]
    pub sort_order: SortOrder,
    /// Whether to automatically watch the current directory for file changes.
    #[garde(skip)]
    pub watch_directory_changes: bool,
}

/// Settings for the reading experience.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct ReaderSettings {
    /// Configuration specific to reading comics/manga (images).
    #[garde(dive)]
    pub comic: ComicSettings,
    /// Configuration specific to reading novels (text).
    #[garde(dive)]
    pub novel: NovelSettings,
    /// Configuration for how pages and previews are rendered.
    #[garde(dive)]
    pub rendering: RenderingSettings,
    /// Behavior when paging past the last/first page of a book (auto-open adjacent book).
    #[garde(skip)]
    pub auto_open_adjacent_book: AutoOpenAdjacentBookMode,
}

/// Configuration specific to reading comics (image-based content).
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct ComicSettings {
    /// The reading direction (e.g., Right-to-Left for Japanese manga).
    #[garde(skip)]
    pub reading_direction: Direction,
    /// Whether to display pages side-by-side (two-page spread).
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub enable_spread: bool,
    /// Whether to force the first page (cover) to display as a single page in spread mode.
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub show_cover_as_single_page: bool,
    /// Configuration for the Loupe (Magnifier) feature.
    #[garde(dive)]
    pub loupe: LoupeSettings,
    /// Configuration for image caching and preloading.
    #[garde(dive)]
    pub cache: ComicCacheSettings,
}

impl Default for ComicSettings {
    fn default() -> Self {
        Self {
            reading_direction: Direction::default(),
            enable_spread: default_true(),
            show_cover_as_single_page: default_true(),
            loupe: LoupeSettings::default(),
            cache: ComicCacheSettings::default(),
        }
    }
}

/// Configuration for image caching and preloading.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct ComicCacheSettings {
    /// The number of pages to preload in each direction (forward and backward).
    #[garde(range(min = 0, max = 10000))]
    #[serde(default = "default_preload_page_count")]
    pub preload_page_count: i32,
    /// The maximum size of the image memory cache in MiB.
    #[garde(range(min = 1, max = 65536))]
    #[serde(default = "default_image_cache_size_mib")]
    pub image_cache_size_mib: u64,
}

impl Default for ComicCacheSettings {
    fn default() -> Self {
        Self {
            preload_page_count: default_preload_page_count(),
            image_cache_size_mib: default_image_cache_size_mib(),
        }
    }
}

fn default_preload_page_count() -> i32 {
    10
}

fn default_image_cache_size_mib() -> u64 {
    1024
}

/// Configuration for the Loupe (Magnifier) feature.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct LoupeSettings {
    /// The magnification zoom level of the loupe (`1.0` = no magnification).
    #[garde(range(min = 1.0, max = 100.0), custom(finite_f64))]
    #[serde(default = "default_loupe_zoom")]
    pub zoom: f64,
    /// The radius (size) of the loupe.
    #[garde(range(min = 1.0, max = 5000.0), custom(finite_f64))]
    #[serde(default = "default_loupe_radius")]
    pub radius: f64,
    /// The keyboard shortcut key to toggle the loupe.
    #[garde(skip)]
    #[serde(default = "default_loupe_toggle_key")]
    pub toggle_key: String,
}

impl Default for LoupeSettings {
    fn default() -> Self {
        Self {
            zoom: default_loupe_zoom(),
            radius: default_loupe_radius(),
            toggle_key: default_loupe_toggle_key(),
        }
    }
}

fn default_loupe_zoom() -> f64 {
    2.0
}

fn default_loupe_radius() -> f64 {
    200.0
}

fn default_loupe_toggle_key() -> String {
    "MouseMiddle".to_string()
}

/// Configuration specific to reading novels (text-based content).
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct NovelSettings {
    /// The font family used for rendering the text.
    #[garde(skip)]
    #[serde(default = "default_novel_font_family")]
    pub font_family: String,
    /// The size of the font used for rendering the text. Fractional sizes are allowed.
    #[garde(range(min = 1.0, max = 200.0), custom(finite_f64))]
    #[serde(default = "default_novel_font_size")]
    pub font_size: f64,
}

impl Default for NovelSettings {
    fn default() -> Self {
        Self {
            font_family: default_novel_font_family(),
            font_size: default_novel_font_size(),
        }
    }
}

fn default_novel_font_family() -> String {
    "default-font".to_string()
}

fn default_novel_font_size() -> f64 {
    16.0
}

/// Configuration for image and document rendering.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct RenderingSettings {
    /// Whether to generate and display thumbnail previews for pages.
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub enable_thumbnail_preview: bool,
    /// The maximum allowed height for an image before it is scaled down (`0` = unlimited).
    #[garde(range(min = 0, max = 65535))]
    pub max_image_height: i32,
    /// The algorithm used for resampling (resizing) images.
    #[garde(skip)]
    pub image_resampling_method: ImageResamplingMethod,
    /// The vertical resolution used when rasterizing PDF pages to images.
    #[garde(range(min = 1, max = 20000))]
    #[serde(default = "default_pdf_render_resolution_height")]
    pub pdf_render_resolution_height: i32,
}

impl Default for RenderingSettings {
    fn default() -> Self {
        Self {
            enable_thumbnail_preview: default_true(),
            max_image_height: i32::default(),
            image_resampling_method: ImageResamplingMethod::default(),
            pdf_render_resolution_height: default_pdf_render_resolution_height(),
        }
    }
}

fn default_pdf_render_resolution_height() -> i32 {
    2000
}

/// Settings related to tracking user history.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct HistorySettings {
    /// Whether to record the user's reading history and progress.
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub record_reading_history: bool,
}

impl Default for HistorySettings {
    fn default() -> Self {
        Self {
            record_reading_history: default_true(),
        }
    }
}

/// Settings related to the application's layout.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct LayoutSettings {
    /// Settings for the side pane (tabs and visibility).
    #[garde(dive)]
    pub side_pane: SidePaneSettings,
}

/// Settings for the side pane.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct SidePaneSettings {
    /// Whether the side pane is hidden.
    #[garde(skip)]
    pub is_hidden: bool,
    /// The index of the active tab in the side pane.
    #[garde(range(min = 0, max = 100))]
    pub tab_index: i32,
}

/// Represents the application's visual theme.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AppTheme {
    /// Matches the operating system's theme preference.
    #[default]
    System,
    /// Light color scheme.
    Light,
    /// Dark color scheme.
    Dark,
}

/// Represents the severity level for application logs.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Trace,
    Debug,
    #[default]
    Info,
    Warn,
    Error,
}

/// Represents the initial view shown when the app starts.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum InitialView {
    /// Opens the reading interface.
    #[default]
    Reader,
    /// Opens the bookshelf / library interface.
    Bookshelf,
}

/// Represents the criteria used for sorting items.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    /// Sort alphabetically by name, ascending (A-Z).
    #[default]
    NameAsc,
    /// Sort alphabetically by name, descending (Z-A).
    NameDesc,
    /// Sort by date, ascending (Oldest first).
    DateAsc,
    /// Sort by date, descending (Newest first).
    DateDesc,
}

/// Represents the direction in which content should be read.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    /// Right-to-Left (e.g., traditional Japanese manga).
    #[default]
    Rtl,
    /// Left-to-Right (e.g., western comics).
    Ltr,
}

/// Behavior when paging past the last/first page of a book.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AutoOpenAdjacentBookMode {
    /// Do nothing at the book boundary (stay on the page).
    Off,
    /// Ask for confirmation before opening the adjacent book.
    #[default]
    Ask,
    /// Open the adjacent book automatically.
    Auto,
}

/// Represents the algorithm used for resampling images.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ImageResamplingMethod {
    /// Nearest Neighbor
    Nearest,
    /// Box Filter (formerly Gaussian)
    #[serde(alias = "gaussian")]
    Box,
    /// Bilinear Filter (formerly Triangle)
    #[default]
    #[serde(alias = "triangle")]
    Bilinear,
    /// Hamming Filter
    Hamming,
    /// Cubic Filter
    CatmullRom,
    /// Mitchell-Netravali Filter
    MitchellNetravali,
    /// Lanczos with window 3
    Lanczos3,
}

/// A helper function to provide a default `true` value for Serde deserialization.
///
/// This function is used in conjunction with the `#[serde(default = "...")]`
/// attribute to override Rust's standard boolean default (`false`) when a
/// specific key is missing from the JSON configuration file.
fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    struct MockProvider {
        mock_json: Value,
    }

    impl SettingsStoreProvider for MockProvider {
        fn get_all_settings(&self) -> Value {
            self.mock_json.clone()
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
        fn get_all_settings(&self) -> Value {
            self.last_saved
                .lock()
                .unwrap()
                .clone()
                .unwrap_or_else(|| self.initial.clone())
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

    /// A full, valid document with a non-empty home directory, so `normalize` makes
    /// no changes (used as a stable baseline for persist-on-change tests).
    fn default_doc_with_home() -> Value {
        let mut settings = AppSettings::default();
        settings.file_navigator.home_directory = PathBuf::from("/mock/home");
        serde_json::to_value(&settings).unwrap()
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

    // ---- garde validation: bounds ----

    #[test]
    fn test_default_settings_are_valid() {
        assert!(AppSettings::default().validate().is_ok());
    }

    #[rstest]
    #[case(0, true)]
    #[case(2, true)]
    #[case(3, false)]
    fn test_grid_size_bounds(#[case] value: u8, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.bookshelf.grid_size = value;
        assert_eq!(s.validate().is_ok(), valid, "grid_size={value}");
    }

    #[rstest]
    #[case(0, true)]
    #[case(10000, true)]
    #[case(-1, false)]
    #[case(10001, false)]
    fn test_preload_page_count_bounds(#[case] value: i32, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.comic.cache.preload_page_count = value;
        assert_eq!(s.validate().is_ok(), valid, "preload_page_count={value}");
    }

    #[rstest]
    #[case(1, true)]
    #[case(65536, true)]
    #[case(0, false)]
    #[case(65537, false)]
    fn test_image_cache_size_mib_bounds(#[case] value: u64, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.comic.cache.image_cache_size_mib = value;
        assert_eq!(s.validate().is_ok(), valid, "image_cache_size_mib={value}");
    }

    #[rstest]
    #[case(0, true)]
    #[case(65535, true)]
    #[case(-1, false)]
    #[case(65536, false)]
    fn test_max_image_height_bounds(#[case] value: i32, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.rendering.max_image_height = value;
        assert_eq!(s.validate().is_ok(), valid, "max_image_height={value}");
    }

    #[rstest]
    #[case(1, true)]
    #[case(20000, true)]
    #[case(0, false)]
    #[case(20001, false)]
    fn test_pdf_render_resolution_height_bounds(#[case] value: i32, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.rendering.pdf_render_resolution_height = value;
        assert_eq!(
            s.validate().is_ok(),
            valid,
            "pdf_render_resolution_height={value}"
        );
    }

    #[rstest]
    #[case(0, true)]
    #[case(100, true)]
    #[case(-1, false)]
    #[case(101, false)]
    fn test_tab_index_bounds(#[case] value: i32, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.layout.side_pane.tab_index = value;
        assert_eq!(s.validate().is_ok(), valid, "tab_index={value}");
    }

    #[rstest]
    #[case(1.0, true)]
    #[case(200.0, true)]
    #[case(0.9, false)]
    #[case(200.1, false)]
    fn test_font_size_bounds(#[case] value: f64, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.novel.font_size = value;
        assert_eq!(s.validate().is_ok(), valid, "font_size={value}");
    }

    #[rstest]
    #[case(1.0, true)]
    #[case(100.0, true)]
    #[case(0.9, false)]
    #[case(100.1, false)]
    #[case(f64::NAN, false)]
    #[case(f64::INFINITY, false)]
    fn test_loupe_zoom_bounds(#[case] value: f64, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.comic.loupe.zoom = value;
        assert_eq!(s.validate().is_ok(), valid, "zoom={value}");
    }

    #[rstest]
    #[case(1.0, true)]
    #[case(5000.0, true)]
    #[case(0.9, false)]
    #[case(5000.1, false)]
    #[case(f64::NAN, false)]
    fn test_loupe_radius_bounds(#[case] value: f64, #[case] valid: bool) {
        let mut s = AppSettings::default();
        s.reader.comic.loupe.radius = value;
        assert_eq!(s.validate().is_ok(), valid, "radius={value}");
    }

    #[test]
    fn test_nested_invalid_fails_whole_tree() {
        let mut s = AppSettings::default();
        s.reader.rendering.pdf_render_resolution_height = 0;
        assert!(s.validate().is_err());
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

    // ---- json_deep_merge ----

    #[test]
    fn test_json_deep_merge_preserves_siblings() {
        let mut target = json!({
            "reader": { "rendering": { "maxImageHeight": 0, "pdfRenderResolutionHeight": 2000 } }
        });
        json_deep_merge(
            &mut target,
            json!({ "reader": { "rendering": { "maxImageHeight": 500 } } }),
        );
        assert_eq!(target["reader"]["rendering"]["maxImageHeight"], 500);
        assert_eq!(
            target["reader"]["rendering"]["pdfRenderResolutionHeight"],
            2000
        );
    }

    #[test]
    fn test_json_deep_merge_overwrites_non_object() {
        let mut target = json!({ "a": { "b": 1 } });
        json_deep_merge(&mut target, json!({ "a": 5 }));
        assert_eq!(target["a"], 5);
    }

    // ---- load purity ----

    #[rstest]
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

    // ---- apply_patch_serialized ----

    #[tokio::test]
    async fn test_apply_patch_preserves_same_category_siblings() {
        let provider = RecordingProvider::new(default_doc_with_home());
        let lock = tokio::sync::Mutex::new(());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 500 } }));

        let merged = AppSettings::apply_patch_serialized(&provider, &lock, patch)
            .await
            .unwrap();

        assert_eq!(merged.reader.rendering.max_image_height, 500);
        // Sibling leaf of the same coarse category is preserved.
        assert!(merged.reader.comic.enable_spread);
        assert_eq!(provider.save_count(), 1);
    }

    #[tokio::test]
    async fn test_apply_patch_rejects_out_of_range_without_persisting() {
        let provider = RecordingProvider::new(default_doc_with_home());
        let lock = tokio::sync::Mutex::new(());
        let patch = SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 70000 } }));

        let result = AppSettings::apply_patch_serialized(&provider, &lock, patch).await;

        assert!(result.is_err());
        assert_eq!(provider.save_count(), 0);
    }

    #[tokio::test]
    async fn test_apply_patch_sequential_accumulates() {
        let provider = RecordingProvider::new(default_doc_with_home());
        let lock = tokio::sync::Mutex::new(());

        AppSettings::apply_patch_serialized(
            &provider,
            &lock,
            SettingsPatch::Reader(json!({ "rendering": { "maxImageHeight": 500 } })),
        )
        .await
        .unwrap();
        let merged = AppSettings::apply_patch_serialized(
            &provider,
            &lock,
            SettingsPatch::Bookshelf(json!({ "gridSize": 2 })),
        )
        .await
        .unwrap();

        // The second read-modify-write sees the first write's result.
        assert_eq!(merged.reader.rendering.max_image_height, 500);
        assert_eq!(merged.bookshelf.grid_size, 2);
    }

    #[test]
    fn test_snake_to_camel_case() {
        assert_eq!(snake_to_camel_case("max_image_height"), "maxImageHeight");
        assert_eq!(snake_to_camel_case("zoom"), "zoom");
        assert_eq!(
            snake_to_camel_case("pdf_render_resolution_height"),
            "pdfRenderResolutionHeight"
        );
    }
}
