use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::{collections::HashMap, fmt};
use tauri::{App, Manager};
use tauri_plugin_store::StoreExt;

use crate::error::Result;

/// Trait for settings storage to enable testing and abstract the storage mechanism.
pub trait SettingsStoreProvider {
    /// Retrieves all settings from the store as a single JSON `Value`.
    fn get_all_settings(&self) -> Value;
    /// Retrieves the default home directory dynamically based on the OS.
    fn default_home_dir(&self) -> String;
}

/// Real implementation of `SettingsStoreProvider` using `tauri-plugin-store`.
pub struct TauriStoreProvider<'a> {
    app: &'a App,
    filename: String,
}

impl<'a> SettingsStoreProvider for TauriStoreProvider<'a> {
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

    fn default_home_dir(&self) -> String {
        self.app
            .path()
            .home_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    }
}

/// Represents the root configuration of the application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    /// General application settings, including theming and fonts.
    pub general: GeneralSettings,
    /// Settings related to the application's startup behavior.
    pub startup: StartupSettings,
    /// Settings specific to the bookshelf (library) view.
    pub bookshelf: BookshelfSettings,
    /// Settings for the file navigator and directory management.
    pub file_navigator: FileNavigatorSettings,
    /// Settings for reading content (both comics and novels).
    pub reader: ReaderSettings,
    /// Settings related to user history and tracking.
    pub history: HistorySettings,
}

impl AppSettings {
    /// Loads the application settings from a persistent storage file.
    ///
    /// This function reads all settings from the `tauri-plugin-store` and deserializes
    /// them into the `AppConfig` struct. Missing fields are populated with default values.
    ///
    /// # Arguments
    ///
    /// * `app` - A reference to the Tauri `App` instance to access the store.
    /// * `filename` - The name of the store file to load settings from.
    pub fn load(app: &App, filename: &str) -> Result<Self> {
        let provider = TauriStoreProvider {
            app,
            filename: filename.to_string(),
        };
        Self::load_from_provider(&provider)
    }

    /// Internal load logic that uses a provider for testability.
    pub fn load_from_provider<P: SettingsStoreProvider>(provider: &P) -> Result<Self> {
        let json_val = provider.get_all_settings();

        let mut config: AppSettings = match serde_json::from_value(json_val) {
            Ok(c) => c,
            Err(e) => {
                println!(
                    "[Warn] Failed to parse settings, using default. Error: {}",
                    e
                );
                AppSettings::default()
            }
        };

        // Dynamically set the default home directory if it's empty (e.g., on first launch).
        if config.file_navigator.home_directory.as_os_str().is_empty() {
            config.file_navigator.home_directory = PathBuf::from(provider.default_home_dir());
        }

        Ok(config)
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
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct GeneralSettings {
    /// The application's color theme.
    pub theme: AppTheme,
    /// The font family used for the application's UI.
    pub app_font_family: String,
    /// Configuration for application logging.
    pub log: LogSettings,
    /// A flexible map for toggling or configuring experimental features.
    pub experimental_features: HashMap<String, serde_json::Value>,
}

/// Configuration for application logging.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct LogSettings {
    /// The minimum severity level to log.
    pub level: LogLevel,
}

/// Settings related to the application's startup behavior.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StartupSettings {
    /// The initial view presented to the user upon launch.
    pub initial_view: InitialView,
    /// Whether to automatically restore the last opened book/container on startup.
    #[serde(default = "default_true")]
    pub restore_last_book: bool,
}

impl Default for StartupSettings {
    fn default() -> Self {
        Self {
            initial_view: InitialView::default(),
            restore_last_book: default_true(),
        }
    }
}

/// Settings specific to the bookshelf view.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct BookshelfSettings {
    /// The criteria used to sort items in the bookshelf.
    pub sort_order: SortOrder,
    /// The number of size to display in the bookshelf grid.
    pub grid_size: u8,
}

/// Settings for the file navigator.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FileNavigatorSettings {
    /// The default directory opened when clicking the Home button.
    pub home_directory: PathBuf,
    /// The criteria used to sort files and directories.
    pub sort_order: SortOrder,
    /// Whether to automatically watch the current directory for file changes.
    pub watch_directory_changes: bool,
}

/// Settings for the reading experience.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ReaderSettings {
    /// Configuration specific to reading comics/manga (images).
    pub comic: ComicSettings,
    /// Configuration specific to reading novels (text).
    pub novel: NovelSettings,
    /// Configuration for how pages and previews are rendered.
    pub rendering: RenderingSettings,
}

/// Configuration specific to reading comics (image-based content).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ComicSettings {
    /// The reading direction (e.g., Right-to-Left for Japanese manga).
    pub reading_direction: Direction,
    /// Whether to display pages side-by-side (two-page spread).
    #[serde(default = "default_true")]
    pub enable_spread: bool,
    /// Whether to force the first page (cover) to display as a single page in spread mode.
    #[serde(default = "default_true")]
    pub show_cover_as_single_page: bool,
}

impl Default for ComicSettings {
    fn default() -> Self {
        Self {
            reading_direction: Direction::default(),
            enable_spread: default_true(),
            show_cover_as_single_page: default_true(),
        }
    }
}

/// Configuration specific to reading novels (text-based content).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct NovelSettings {
    /// The font family used for rendering the text.
    pub font_family: String,
    /// The size of the font used for rendering the text.
    pub font_size: i32,
}

/// Configuration for image and document rendering.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RenderingSettings {
    /// Whether to generate and display thumbnail previews for pages.
    #[serde(default = "default_true")]
    pub enable_thumbnail_preview: bool,
    /// The maximum allowed height for an image before it is scaled down.
    pub max_image_height: i32,
    /// The algorithm used for resampling (resizing) images.
    pub image_resampling_method: ImageResamplingMethod,
    /// The vertical resolution used when rasterizing PDF pages to images.
    pub pdf_render_resolution_height: i32,
}

impl Default for RenderingSettings {
    fn default() -> Self {
        Self {
            enable_thumbnail_preview: default_true(),
            max_image_height: i32::default(),
            image_resampling_method: ImageResamplingMethod::default(),
            pdf_render_resolution_height: i32::default(),
        }
    }
}

/// Settings related to tracking user history.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HistorySettings {
    /// Whether to record the user's reading history and progress.
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

/// Represents the algorithm used for resampling images.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ImageResamplingMethod {
    /// Nearest Neighbor
    Nearest,
    /// Linear Filter
    #[default]
    Triangle,
    /// Cubic Filter
    CatmullRom,
    /// Gaussian Filter
    Gaussian,
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
    use serde_json::json;

    struct MockProvider {
        mock_json: Value,
    }

    impl SettingsStoreProvider for MockProvider {
        fn get_all_settings(&self) -> Value {
            self.mock_json.clone()
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
        let settings = AppSettings::load_from_provider(&provider).unwrap();

        // Check dynamically assigned default
        assert_eq!(
            settings.file_navigator.home_directory.to_str().unwrap(),
            "/mock/home"
        );
        // Check static defaults
        assert!(matches!(settings.general.theme, AppTheme::System));
        assert!(settings.reader.comic.enable_spread);
    }

    #[test]
    fn test_load_partial_settings() {
        let provider = MockProvider {
            mock_json: json!({
                "general": { "theme": "dark" },
                "reader": { "comic": { "enableSpread": false } }
            }),
        };
        let settings = AppSettings::load_from_provider(&provider).unwrap();

        // Provided values should be parsed correctly
        assert!(matches!(settings.general.theme, AppTheme::Dark));
        assert!(!settings.reader.comic.enable_spread);

        // Omitted values should fall back to defaults safely
        assert!(matches!(settings.startup.initial_view, InitialView::Reader));
    }
}
