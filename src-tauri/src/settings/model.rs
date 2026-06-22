use std::collections::HashMap;
use std::path::PathBuf;

use garde::Validate;
use serde::{Deserialize, Serialize};

use super::validation::finite_f64;

/// General application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
    ///
    /// Exported to TypeScript with `unknown` values: `serde_json::Value` is an inline,
    /// recursive type the exporter cannot expand, and experimental flags are arbitrary.
    #[garde(skip)]
    #[specta(type = std::collections::HashMap<String, specta_typescript::Unknown>)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct LogSettings {
    /// The minimum severity level to log.
    #[garde(skip)]
    pub level: LogLevel,
}

/// Settings related to the application's startup behavior.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct LoupeSettings {
    /// The magnification zoom level of the loupe (`1.0` = no magnification).
    #[garde(range(min = 1.0, max = 100.0), custom(finite_f64))]
    #[serde(default = "default_loupe_zoom")]
    pub zoom: f64,
    /// The radius (size) of the loupe.
    #[garde(range(min = 50.0, max = 5000.0), custom(finite_f64))]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct LayoutSettings {
    /// Settings for the side pane (tabs and visibility).
    #[garde(dive)]
    pub side_pane: SidePaneSettings,
}

/// Settings for the side pane.
#[derive(Debug, Clone, Serialize, Deserialize, Default, Validate, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum InitialView {
    /// Opens the reading interface.
    #[default]
    Reader,
    /// Opens the bookshelf / library interface.
    Bookshelf,
}

/// Represents the criteria used for sorting items.
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    /// Right-to-Left (e.g., traditional Japanese manga).
    #[default]
    Rtl,
    /// Left-to-Right (e.g., western comics).
    Ltr,
}

/// Behavior when paging past the last/first page of a book.
#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
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
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, specta::Type)]
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
    use crate::settings::AppSettings;
    use garde::Validate;
    use rstest::rstest;

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
    #[case(50.0, true)]
    #[case(5000.0, true)]
    #[case(49.9, false)]
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
}
