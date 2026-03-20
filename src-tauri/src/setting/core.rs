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

/// Trait for settings storage to enable testing.
pub trait SettingsStoreProvider {
    fn get_value(&self, key: &str) -> Option<serde_json::Value>;
    fn home_dir(&self) -> String;
}

/// Real implementation using tauri-plugin-store.
struct TauriStoreProvider<'a> {
    app: &'a App,
    filename: String,
}

impl<'a> SettingsStoreProvider for TauriStoreProvider<'a> {
    fn get_value(&self, key: &str) -> Option<serde_json::Value> {
        self.app
            .store(&self.filename)
            .ok()
            .and_then(|store| store.get(key))
    }

    fn home_dir(&self) -> String {
        self.app
            .path()
            .home_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    }
}

/// Represents the application's configurable settings.
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
        let provider = TauriStoreProvider {
            app,
            filename: filename.to_string(),
        };
        Self::load_from_provider(&provider)
    }

    /// Internal load logic that uses a provider for testability.
    pub fn load_from_provider<P: SettingsStoreProvider>(provider: &P) -> Result<Self> {
        Ok(Self {
            font_family: provider
                .get_value("font-family")
                .and_then(|value| value.as_str().map(|v| v.to_string()))
                .unwrap_or_else(|| "Inter, Avenir, Helvetica, Arial, sans-serif".to_string()),
            direction: provider
                .get_value("direction")
                .map(|value| value.into())
                .unwrap_or(Direction::Ltr),
            enable_directory_watch: provider
                .get_value("enable-directory-watch")
                .and_then(|value| value.as_bool())
                .unwrap_or(false),
            experimental_features: provider
                .get_value("experimental-features")
                .map(|value| value.into())
                .unwrap_or_default(),
            first_page_single_view: provider
                .get_value("first-page-single-view")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
            history: provider
                .get_value("history")
                .map(|value| value.into())
                .unwrap_or_default(),
            home_directory: provider
                .get_value("home-directory")
                .and_then(|value| value.as_str().map(|v| v.to_string()))
                .unwrap_or_else(|| provider.home_dir()),
            log: provider
                .get_value("log")
                .map(|value| value.into())
                .unwrap_or_default(),
            novel_reader: provider
                .get_value("novel-reader")
                .map(|value| value.into())
                .unwrap_or_default(),
            rendering: provider
                .get_value("rendering")
                .map(|value| value.into())
                .unwrap_or_default(),
            sort_order: provider
                .get_value("sort-order")
                .map(|value| value.into())
                .unwrap_or(SortOrder::NameAsc),
            theme: provider
                .get_value("theme")
                .map(|value| value.into())
                .unwrap_or(AppTheme::System),
            two_paged: provider
                .get_value("two-paged")
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;

    struct MockProvider {
        values: HashMap<String, serde_json::Value>,
    }

    impl SettingsStoreProvider for MockProvider {
        fn get_value(&self, key: &str) -> Option<serde_json::Value> {
            self.values.get(key).cloned()
        }
        fn home_dir(&self) -> String {
            "/mock/home".to_string()
        }
    }

    #[test]
    fn test_load_default_settings() {
        let provider = MockProvider {
            values: HashMap::new(),
        };
        let settings = Settings::load_from_provider(&provider).unwrap();

        assert_eq!(
            settings.font_family,
            "Inter, Avenir, Helvetica, Arial, sans-serif"
        );
        assert_eq!(settings.direction, Direction::Ltr);
        assert_eq!(settings.home_directory, "/mock/home");
        assert!(settings.two_paged);
    }

    #[test]
    fn test_load_custom_settings() {
        let mut values = HashMap::new();
        values.insert("font-family".to_string(), json!("Custom Font"));
        values.insert("two-paged".to_string(), json!(false));
        values.insert("home-directory".to_string(), json!("/custom/home"));

        let provider = MockProvider { values };
        let settings = Settings::load_from_provider(&provider).unwrap();

        assert_eq!(settings.font_family, "Custom Font");
        assert!(!settings.two_paged);
        assert_eq!(settings.home_directory, "/custom/home");
    }
}
