use std::fmt::Display;

use tauri::{App, Manager};
use tauri_plugin_store::StoreExt;

use crate::{
    error::Result,
    setting::{
        app_theme::AppTheme, direction::Direction,
        experimental_features_settings::ExperimentalFeaturesSettings,
        history_settings::HistorySettings, log_settings::LogSettings,
        novel_reader_settings::NovelReaderSettings, rendering_settings::RenderingSettings,
        sort_order::SortOrder,
    },
};

/// Represents the application's configurable settings.
///
/// This struct aggregates all user-configurable options for the application,
/// ranging from UI preferences to backend behavior.
#[allow(dead_code)]
pub struct Settings {
    /// The default font family to be used for rendering text.
    pub font_family: String,
    /// The reading direction for content (e.g., Left-to-Right or Right-to-Left).
    pub direction: Direction,
    /// If `true`, the application will automatically watch directories for changes.
    pub enable_directory_watch: bool,
    /// A nested struct containing settings for experimental features.
    pub experimental_features: ExperimentalFeaturesSettings,
    /// If `true`, the first page of a book is shown as a single page in two-page view.
    pub first_page_single_view: bool,
    /// A nested struct for settings related to browsing history.
    pub history: HistorySettings,
    /// The default directory to open when the application starts.
    pub home_directory: String,
    /// A nested struct for configuring logging behavior.
    pub log: LogSettings,
    /// A nested struct for settings specific to the novel reader view.
    pub novel_reader: NovelReaderSettings,
    /// A nested struct for settings related to image and content rendering.
    pub rendering: RenderingSettings,
    /// The default sort order for file and directory listings.
    pub sort_order: SortOrder,
    /// The application's color theme (e.g., Light, Dark, or System default).
    pub theme: AppTheme,
    /// If `true`, content is displayed in a two-page (book-style) layout.
    pub two_paged: bool,
}

#[allow(dead_code)]
impl Settings {
    /// Loads the application settings from a persistent storage file.
    ///
    /// This function reads settings from the `tauri-plugin-store`. If a setting is
    /// not present in the store, a default value is used instead.
    ///
    /// # Arguments
    ///
    /// * `app` - A reference to the Tauri `App` instance to access the store.
    /// * `filename` - The name of the store file to load settings from.
    ///
    /// # Returns
    ///
    /// A `Result` containing the loaded `Settings` instance on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the application store cannot be accessed.
    pub fn load(app: &App, filename: &str) -> Result<Self> {
        let store = app.store(filename)?;

        Ok(Self {
            font_family: store
                .get("font-family")
                .and_then(|value| value.as_str().map(|value| value.to_string()))
                .unwrap_or("Inter, Avenir, Helvetica, Arial, sans-serif".to_string()),
            direction: store
                .get("direction")
                .map(|value| value.into())
                .unwrap_or(Direction::Ltr),
            enable_directory_watch: store
                .get("enable-directory-watch")
                .and_then(|value| value.as_bool())
                .unwrap_or(false),
            experimental_features: store
                .get("experimental-features")
                .map(|value| value.into())
                .unwrap_or_default(),
            first_page_single_view: store
                .get("first-page-single-view")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
            history: store
                .get("history")
                .map(|value| value.into())
                .unwrap_or_default(),
            home_directory: store
                .get("home-directory")
                .and_then(|value| value.as_str().map(|value| value.to_string()))
                .unwrap_or(
                    app.path()
                        .home_dir()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                ),
            log: store
                .get("log")
                .map(|value| value.into())
                .unwrap_or_default(),
            novel_reader: store
                .get("novel-reader")
                .map(|value| value.into())
                .unwrap_or_default(),
            rendering: store
                .get("rendering")
                .map(|value| value.into())
                .unwrap_or_default(),
            sort_order: store
                .get("sort-order")
                .map(|value| value.into())
                .unwrap_or(SortOrder::NameAsc),
            theme: store
                .get("theme")
                .map(|value| value.into())
                .unwrap_or(AppTheme::System),
            two_paged: store
                .get("two-paged")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
        })
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            font_family: "Inter, Avenir, Helvetica, Arial, sans-serif".to_string(),
            direction: Direction::default(),
            enable_directory_watch: false,
            experimental_features: ExperimentalFeaturesSettings::default(),
            first_page_single_view: true,
            history: HistorySettings::default(),
            home_directory: "".to_string(),
            log: LogSettings::default(),
            novel_reader: NovelReaderSettings::default(),
            rendering: RenderingSettings::default(),
            sort_order: SortOrder::default(),
            theme: AppTheme::default(),
            two_paged: true,
        }
    }
}

impl Display for Settings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Settings {{ font_family: {}, direction: {}, enable_directory_watch: {}, experimental_features: {}, first_page_single_view: {}, history: {}, home_directory: {}, log: {}, novel_reader: {}, rendering: {}, sort_order: {}, theme: {}, two_paged: {} }}",
            self.font_family,
            self.direction,
            self.enable_directory_watch,
            self.experimental_features,
            self.first_page_single_view,
            self.history,
            self.home_directory,
            self.log,
            self.novel_reader,
            self.rendering,
            self.sort_order,
            self.theme,
            self.two_paged
        )
    }
}
