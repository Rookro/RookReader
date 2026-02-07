use serde_json::Value;
use tauri::App;
use tauri_plugin_store::StoreExt;

use crate::{
    error::Result,
    setting::{
        app_theme::AppTheme, direction::Direction,
        experimental_features_settings::ExperimentalFeaturesSettings,
        history_settings::HistorySettings, log_settings::LogSettings,
        novel_reader_settings::NovelReaderSettings, sort_order::SortOrder,
    },
};

/// Represents the application settings.
#[allow(dead_code)]
pub struct Settings {
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
    /// PDF rendering height.
    pub pdf_rendering_height: i32,
    /// Novel reader settings.
    pub novel_reader: NovelReaderSettings,
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
    /// * `pdf_rendering_height` - The PDF rendering height.
    /// * `novel_reader` - The novel reader settings.
    /// * `sort_order` - The sort order settings.
    /// * `theme` - The theme settings.
    /// * `two_paged` - Whether to enable two-paged mode.
    ///
    /// # Returns
    /// * The new settings instance.
    pub fn new(
        direction: Direction,
        enable_directory_watch: bool,
        experimental_features: ExperimentalFeaturesSettings,
        first_page_single_view: bool,
        history: HistorySettings,
        home_directory: String,
        log: LogSettings,
        pdf_rendering_height: i32,
        novel_reader: NovelReaderSettings,
        sort_order: SortOrder,
        theme: AppTheme,
        two_paged: bool,
    ) -> Self {
        Self {
            direction,
            enable_directory_watch,
            experimental_features,
            first_page_single_view,
            history,
            home_directory,
            log,
            pdf_rendering_height,
            novel_reader,
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
            direction: store
                .get("direction")
                .unwrap_or(Value::String("ltr".to_string()))
                .try_into()
                .unwrap_or(Direction::LTR),
            enable_directory_watch: store
                .get("enable-directory-watch")
                .unwrap_or(Value::Bool(false))
                .as_bool()
                .unwrap_or(false),
            experimental_features: store
                .get("experimental-features")
                .unwrap_or(Value::Null)
                .try_into()
                .unwrap_or_default(),
            first_page_single_view: store
                .get("first-page-single-view")
                .unwrap_or(Value::Bool(true))
                .as_bool()
                .unwrap_or(true),
            history: store
                .get("history")
                .unwrap_or(Value::Null)
                .try_into()
                .unwrap_or_default(),
            home_directory: store
                .get("home-directory")
                .unwrap_or(Value::String("".to_string()))
                .as_str()
                .unwrap_or_default()
                .to_string(),
            log: store
                .get("log")
                .unwrap_or(Value::Null)
                .try_into()
                .unwrap_or_default(),
            pdf_rendering_height: store
                .get("pdf-rendering-height")
                .unwrap_or(Value::Number(2000.into()))
                .as_i64()
                .unwrap_or(2000)
                .try_into()
                .unwrap_or(2000),
            novel_reader: store
                .get("novel-reader")
                .unwrap_or(Value::Null)
                .try_into()
                .unwrap_or_default(),
            sort_order: store
                .get("sort-order")
                .unwrap_or(Value::String("name-asc".to_string()))
                .try_into()
                .unwrap_or(SortOrder::NameAsc),
            theme: store
                .get("theme")
                .unwrap_or(Value::String("system".to_string()))
                .try_into()
                .unwrap_or(AppTheme::System),
            two_paged: store
                .get("two-paged")
                .unwrap_or(Value::Bool(true))
                .as_bool()
                .unwrap_or(true),
        });
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            direction: Direction::LTR,
            enable_directory_watch: false,
            experimental_features: ExperimentalFeaturesSettings::default(),
            first_page_single_view: true,
            history: HistorySettings::default(),
            home_directory: "".to_string(),
            log: LogSettings::default(),
            pdf_rendering_height: 2000,
            novel_reader: NovelReaderSettings::default(),
            sort_order: SortOrder::NameAsc,
            theme: AppTheme::System,
            two_paged: true,
        }
    }
}
