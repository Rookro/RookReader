use chrono::Local;
use log::debug;
use sqlx::{
    migrate,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::{fs, str::FromStr, sync::Arc};
use tauri::{App, Manager, Theme};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tokio::sync::RwLock;

use crate::{
    domain::{
        book::repository::BookRepository, bookshelf::repository::BookshelfRepository,
        series::repository::SeriesRepository, tag::repository::TagRepository,
    },
    error::{self, Error},
    infrastructure::database::{
        book_repository::SqliteBookRepository, bookshelf_repository::SqliteBookshelfRepository,
        series_repository::SqliteSeriesRepository, tag_repository::SqliteTagRepository,
    },
    settings::{AppSettings, AppTheme, LogLevel, LogSettings, TauriStoreProvider},
    state::app_state::AppState,
};

/// Returns the settings store filename for the current build profile.
pub fn settings_filename() -> &'static str {
    if cfg!(debug_assertions) {
        "rook-reader_settings_dev.json"
    } else {
        "rook-reader_settings.json"
    }
}

/// Orchestrates the initial setup of the application.
///
/// This function is the main entry point for configuring the app at startup. It initializes
/// the logger, sets the application theme, and configures container-related settings.
///
/// # Arguments
///
/// * `app` - A reference to the Tauri `App` instance.
///
/// # Errors
///
/// Returns an `Err` if loading the settings or any of the setup sub-routines (e.g., logger setup) fail.
pub fn setup(app: &App) -> error::Result<()> {
    let provider = TauriStoreProvider::new(app.handle(), settings_filename());
    let settings = AppSettings::load_and_persist_normalized(&provider)?;

    setup_logger(app, &settings.general.log)?;
    set_theme(app, &settings.general.theme);
    setup_database(app)?;

    setup_container_settings(app, &settings)?;

    debug!("Application setup completed. Settings: {}", settings);
    Ok(())
}

/// Applies container-specific settings to the application's state.
///
/// This function configures how containers are handled by updating the `ContainerState`
/// with values from the loaded `Settings`. This includes locating the `pdfium` library
/// and setting image rendering parameters.
///
/// # Arguments
///
/// * `app` - A reference to the Tauri `App` instance to access the managed state.
/// * `settings` - The application's loaded settings.
///
/// # Errors
///
/// Returns an `Err` if locating the bundled libraries directory fails.
pub fn setup_container_settings(app: &App, settings: &AppSettings) -> error::Result<()> {
    let state: tauri::State<'_, RwLock<AppState>> = app.state();
    let mut locked_state = state.blocking_write();

    locked_state.container_state.settings.pdfium_library_path = Some(get_libs_dir(app)?);
    apply_reader_settings_to_container(&mut locked_state, settings);

    Ok(())
}

/// Applies the reader/rendering settings to the live container runtime state.
///
/// This reflects the persisted settings into `ContainerState`, so changes take effect
/// without a restart. The image cache is rebuilt **only when its capacity changed**,
/// because rebuilding evicts every cached image.
///
/// # Arguments
///
/// * `state` - The mutable application state to update.
/// * `settings` - The settings whose reader values should be applied.
pub fn apply_reader_settings_to_container(state: &mut AppState, settings: &AppSettings) {
    let new_cache_size_mib = settings.reader.comic.cache.image_cache_size_mib;
    let container_settings = &mut state.container_state.settings;
    // Capture the previous capacity before overwriting it.
    let cache_size_changed = container_settings.image_cache_size_mib != new_cache_size_mib;

    container_settings.enable_preview = settings.reader.rendering.enable_thumbnail_preview;
    container_settings.max_image_height = settings.reader.rendering.max_image_height;
    container_settings.image_cache_size_mib = new_cache_size_mib;
    container_settings.pdf_render_resolution_height =
        settings.reader.rendering.pdf_render_resolution_height;
    container_settings.image_resampling_method =
        settings.reader.rendering.image_resampling_method.into();

    if cache_size_changed {
        state
            .container_state
            .update_image_cache_size(new_cache_size_mib);
    }
}

/// Initializes the application's logging system using `tauri-plugin-log`.
///
/// Configures log level, format, rotation, and targets (stdout and a log file in the
/// app's log directory). It also sets a higher log level for noisy libraries to
/// keep the logs clean.
///
/// # Arguments
///
/// * `app` - A reference to the Tauri `App` instance to attach the plugin.
/// * `settings` - The log settings to apply.
///
/// # Errors
///
/// Returns an `Err` if the logger plugin fails to build or attach to the app.
pub fn setup_logger(app: &App, settings: &LogSettings) -> error::Result<()> {
    let level = match settings.level {
        LogLevel::Trace => log::LevelFilter::Trace,
        LogLevel::Debug => log::LevelFilter::Debug,
        LogLevel::Info => log::LevelFilter::Info,
        LogLevel::Warn => log::LevelFilter::Warn,
        LogLevel::Error => log::LevelFilter::Error,
    };

    // Set log level to INFO for specific libraries to reduce noise.
    let override_log_level = if level == log::LevelFilter::Debug || level == log::LevelFilter::Trace
    {
        log::LevelFilter::Info
    } else {
        level
    };

    app.handle().plugin(
        tauri_plugin_log::Builder::new()
            .level(level)
            .level_for("html5ever", override_log_level)
            .level_for("selectors", override_log_level)
            .format(|out, message, record| {
                out.finish(format_args!(
                    "{}: [{}] [{}] [{}::L{}] {}",
                    Local::now(),
                    record.level(),
                    record.target(),
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    message
                ))
            })
            .targets([
                Target::new(TargetKind::LogDir { file_name: None }),
                Target::new(TargetKind::Stdout),
            ])
            .max_file_size(5 * 1024 * 1024)
            .rotation_strategy(RotationStrategy::KeepSome(10))
            .build(),
    )?;

    Ok(())
}

/// Helper function to apply the chosen `AppTheme` to the Tauri application.
fn set_theme(app: &App, app_theme: &AppTheme) {
    let theme = match app_theme {
        AppTheme::Light => Some(Theme::Light),
        AppTheme::Dark => Some(Theme::Dark),
        AppTheme::System => None,
    };

    app.set_theme(theme);
}

/// Helper function to initialize the database for the application.
fn setup_database(app: &App) -> error::Result<()> {
    let app_data_dir_path = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir_path)?;

    let db_filename = if cfg!(debug_assertions) {
        "rook-reader-dev.db"
    } else {
        "rook-reader.db"
    };
    let db_path = app_data_dir_path.join(db_filename);
    let db_url = format!("sqlite:{}", db_path.display());
    let options = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);
    log::debug!("Database file path: {:?}", options.get_filename());

    let pool = tauri::async_runtime::block_on(async {
        let pool = SqlitePoolOptions::new().connect_with(options).await?;
        migrate!("./migrations").run(&pool).await?;
        Ok::<SqlitePool, Error>(pool)
    })?;

    let book_repository: Arc<dyn BookRepository> =
        Arc::new(SqliteBookRepository::new(pool.clone()));
    let bookshelf_repository: Arc<dyn BookshelfRepository> =
        Arc::new(SqliteBookshelfRepository::new(pool.clone()));
    let tag_repository: Arc<dyn TagRepository> = Arc::new(SqliteTagRepository::new(pool.clone()));
    let series_repository: Arc<dyn SeriesRepository> =
        Arc::new(SqliteSeriesRepository::new(pool.clone()));

    app.manage(book_repository);
    app.manage(bookshelf_repository);
    app.manage(tag_repository);
    app.manage(series_repository);

    Ok(())
}

/// Helper function to locate the directory containing bundled dynamic libraries.
fn get_libs_dir(app: &App) -> error::Result<String> {
    let libs_dir = app.path().resource_dir()?.join("libs");

    Ok(libs_dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::image::resizer::ResizeFilter;
    use crate::settings::ImageResamplingMethod;

    #[test]
    fn test_apply_reader_settings_to_container() {
        let mut state = AppState::default();
        let mut settings = AppSettings::default();
        settings.reader.rendering.enable_thumbnail_preview = false;
        settings.reader.rendering.max_image_height = 1234;
        settings.reader.rendering.pdf_render_resolution_height = 1500;
        settings.reader.rendering.image_resampling_method = ImageResamplingMethod::Lanczos3;
        settings.reader.comic.cache.image_cache_size_mib = 2048;

        apply_reader_settings_to_container(&mut state, &settings);

        let container_settings = &state.container_state.settings;
        assert!(!container_settings.enable_preview);
        assert_eq!(container_settings.max_image_height, 1234);
        assert_eq!(container_settings.pdf_render_resolution_height, 1500);
        assert_eq!(
            container_settings.image_resampling_method,
            ResizeFilter::Lanczos3
        );
        assert_eq!(container_settings.image_cache_size_mib, 2048);
    }
}
