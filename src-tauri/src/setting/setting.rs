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

/// Represents the application settings.
#[allow(dead_code)]
pub struct Settings {
    /// font-family.
    pub font_family: String,
    /// The direction of reading.
    pub direction: Direction,
    /// Whether to enable directory watch.
    pub enable_directory_watch: bool,
    /// Experimental features settings.
    pub experimental_features: ExperimentalFeaturesSettings,
    /// Whether to show the first page in single view.
    pub first_page_single_view: bool,
    /// History settings.
    pub history: HistorySettings,
    /// Home directory settings.
    pub home_directory: String,
    /// Log settings.
    pub log: LogSettings,
    /// Novel reader settings.
    pub novel_reader: NovelReaderSettings,
    /// Rendering settings.
    pub rendering: RenderingSettings,
    /// Sort order settings.
    pub sort_order: SortOrder,
    /// Theme settings.
    pub theme: AppTheme,
    /// Whether to enable two-paged mode.
    pub two_paged: bool,
}

#[allow(dead_code)]
impl Settings {
    /// Creates a new settings instance.
    ///
    /// # Arguments
    /// * `direction` - The direction of the application.
    /// * `enable_directory_watch` - Whether to enable directory watch.
    /// * `experimental_features` - The experimental features settings.
    /// * `first_page_single_view` - Whether to show the first page in single view.
    /// * `history` - The history settings.
    /// * `home_directory` - The home directory settings.
    /// * `log` - The log settings.
    /// * `novel_reader` - The novel reader settings.
    /// * `rendering` - The rendering settings.
    /// * `sort_order` - The sort order settings.
    /// * `theme` - The theme settings.
    /// * `two_paged` - Whether to enable two-paged mode.
    ///
    /// # Returns
    /// * The new settings instance.
    pub fn new(
        font_family: String,
        direction: Direction,
        enable_directory_watch: bool,
        experimental_features: ExperimentalFeaturesSettings,
        first_page_single_view: bool,
        history: HistorySettings,
        home_directory: String,
        log: LogSettings,
        novel_reader: NovelReaderSettings,
        rendering: RenderingSettings,
        sort_order: SortOrder,
        theme: AppTheme,
        two_paged: bool,
    ) -> Self {
        Self {
            font_family,
            direction,
            enable_directory_watch,
            experimental_features,
            first_page_single_view,
            history,
            home_directory,
            log,
            novel_reader,
            rendering,
            sort_order,
            theme,
            two_paged,
        }
    }

    /// Loads the settings from the given filename.
    ///
    /// # Arguments
    /// * `app` - The application instance.
    /// * `filename` - The filename to load the settings from.
    ///
    /// # Returns
    /// * The loaded settings.
    pub fn load(app: &App, filename: &str) -> Result<Self> {
        let store = app.store(filename)?;

        return Ok(Self {
            font_family: store
                .get("font-family")
                .and_then(|value| match value.as_str() {
                    Some(value) => Some(value.to_string()),
                    None => None,
                })
                .unwrap_or("Inter, Avenir, Helvetica, Arial, sans-serif".to_string()),
            direction: store
                .get("direction")
                .and_then(|value| Some(value.into()))
                .unwrap_or(Direction::LTR),
            enable_directory_watch: store
                .get("enable-directory-watch")
                .and_then(|value| value.as_bool())
                .unwrap_or(false),
            experimental_features: store
                .get("experimental-features")
                .and_then(|value| Some(value.into()))
                .unwrap_or_default(),
            first_page_single_view: store
                .get("first-page-single-view")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
            history: store
                .get("history")
                .and_then(|value| Some(value.into()))
                .unwrap_or_default(),
            home_directory: store
                .get("home-directory")
                .and_then(|value| match value.as_str() {
                    Some(value) => Some(value.to_string()),
                    None => None,
                })
                .unwrap_or(
                    app.path()
                        .home_dir()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                ),
            log: store
                .get("log")
                .and_then(|value| Some(value.into()))
                .unwrap_or_default(),
            novel_reader: store
                .get("novel-reader")
                .and_then(|value| Some(value.into()))
                .unwrap_or_default(),
            rendering: store
                .get("rendering")
                .and_then(|value| Some(value.into()))
                .unwrap_or_default(),
            sort_order: store
                .get("sort-order")
                .and_then(|value| Some(value.into()))
                .unwrap_or(SortOrder::NameAsc),
            theme: store
                .get("theme")
                .and_then(|value| Some(value.into()))
                .unwrap_or(AppTheme::System),
            two_paged: store
                .get("two-paged")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
        });
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            font_family: "Inter, Avenir, Helvetica, Arial, sans-serif".to_string(),
            direction: Direction::LTR,
            enable_directory_watch: false,
            experimental_features: ExperimentalFeaturesSettings::default(),
            first_page_single_view: true,
            history: HistorySettings::default(),
            home_directory: "".to_string(),
            log: LogSettings::default(),
            novel_reader: NovelReaderSettings::default(),
            rendering: RenderingSettings::default(),
            sort_order: SortOrder::NameAsc,
            theme: AppTheme::System,
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
