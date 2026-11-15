use chrono::Local;
use log::debug;
use sqlx::{
    migrate,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};
use std::{fs, path::Path, str::FromStr, sync::Arc};
use tauri::{App, AppHandle, Manager, Runtime, Theme};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tokio::sync::RwLock;

use crate::{
    domain::{
        book::repository::BookRepository, bookmark::repository::BookmarkRepository,
        collection::repository::CollectionRepository, series::repository::SeriesRepository,
        tag::repository::TagRepository,
    },
    error,
    infrastructure::database::{
        book_repository::SqliteBookRepository, bookmark_repository::SqliteBookmarkRepository,
        collection_repository::SqliteCollectionRepository,
        series_repository::SqliteSeriesRepository, tag_repository::SqliteTagRepository,
    },
    paths::app_data_dir,
    settings::{
        AppSettings, AppTheme, CurrentSettings, LogLevel, LogSettings, SettingsFileProvider,
        SettingsStoreProvider,
    },
    state::container_state::ContainerState,
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
    let provider = SettingsFileProvider::new(app.handle(), settings_filename())?;

    // Attach the logger before settings healing runs so its repair warnings are not
    // dropped. Peek only the log level from the raw file (defaulting if unreadable);
    // full load + heal happens right after.
    let log_settings: LogSettings = provider
        .get_all_settings()
        .ok()
        .and_then(|raw| raw.pointer("/general/log").cloned())
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();
    setup_logger(app, &log_settings)?;

    // E2E only: register the WDIO plugins AFTER our logger has claimed the global `log`
    // logger, so tauri-plugin-wdio's own `set_boxed_logger` fails gracefully instead of
    // blocking ours. Then grant the WDIO ACL permission (the plugins must be registered
    // first for the permission to resolve). Gated by the `e2e-test` feature and the
    // `TAURI_WEBDRIVER_PORT` the service sets when it launches the app; absent from
    // shipped/production builds.
    #[cfg(feature = "e2e-test")]
    if std::env::var_os("TAURI_WEBDRIVER_PORT").is_some() {
        let handle = app.handle();
        handle.plugin(tauri_plugin_wdio::init())?;
        handle.plugin(tauri_plugin_wdio_webdriver::init())?;
        handle.add_capability(include_str!("../runtime-capabilities/wdio-webdriver.json"))?;
    }

    let (settings, unread) = AppSettings::load_and_persist_normalized(&provider)?;

    set_theme(app, &settings.general.theme);
    setup_database(app)?;

    setup_container_settings(app, &settings)?;
    app.manage(CurrentSettings::new(settings.clone()));
    app.manage(unread);

    // Provide the settings file provider as managed state so `set_settings`
    // reuses this single instance instead of reconstructing one (and
    // re-running `create_dir_all` / home-dir resolution) on every invocation.
    app.manage(provider);

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
    let state: tauri::State<'_, RwLock<ContainerState>> = app.state();
    let mut locked_state = state.blocking_write();

    locked_state.settings.pdfium_library_path = Some(get_libs_dir(app)?);
    locked_state.apply_settings(settings);

    Ok(())
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
    let app_data_dir_path = app_data_dir(app)?;
    fs::create_dir_all(&app_data_dir_path)?;

    let db_filename = if cfg!(debug_assertions) {
        "rook-reader-dev.db"
    } else {
        "rook-reader.db"
    };
    let db_path = app_data_dir_path.join(db_filename);
    let pool = tauri::async_runtime::block_on(connect_database(&db_path))?;
    // Kept as state so `teardown` can close it when the app exits.
    app.manage(pool.clone());

    let book_repository: Arc<dyn BookRepository> =
        Arc::new(SqliteBookRepository::new(pool.clone()));
    let collection_repository: Arc<dyn CollectionRepository> =
        Arc::new(SqliteCollectionRepository::new(pool.clone()));
    let tag_repository: Arc<dyn TagRepository> = Arc::new(SqliteTagRepository::new(pool.clone()));
    let series_repository: Arc<dyn SeriesRepository> =
        Arc::new(SqliteSeriesRepository::new(pool.clone()));
    let bookmark_repository: Arc<dyn BookmarkRepository> =
        Arc::new(SqliteBookmarkRepository::new(pool.clone()));

    app.manage(book_repository);
    app.manage(collection_repository);
    app.manage(tag_repository);
    app.manage(series_repository);
    app.manage(bookmark_repository);

    Ok(())
}

/// Helper function to open the database at `db_path` and apply pending migrations.
async fn connect_database(db_path: &Path) -> error::Result<SqlitePool> {
    let db_url = format!("sqlite:{}", db_path.display());
    // WAL lets a page-turn write land while a list is being read, and the busy timeout
    // makes a second writer wait for the first instead of failing with SQLITE_BUSY.
    // `PRAGMA optimize` on close keeps the query planner's statistics current; 400 is the
    // analysis limit SQLite recommends.
    let options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5))
        .optimize_on_close(true, 400);
    log::debug!("Database file path: {:?}", options.get_filename());

    let pool = SqlitePoolOptions::new().connect_with(options).await?;
    migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

/// Closes the database pool before the process exits.
///
/// Tauri ends the process with `std::process::exit`, which skips destructors. Unless the
/// pool is closed here, SQLite never checkpoints the WAL and the `-wal` / `-shm` files
/// stay next to the database.
///
/// # Arguments
///
/// * `app` - The handle of the exiting app.
pub fn teardown<R: Runtime>(app: &AppHandle<R>) {
    if let Some(pool) = app.try_state::<SqlitePool>() {
        tauri::async_runtime::block_on(pool.close());
    }
}

/// Helper function to locate the directory containing bundled dynamic libraries.
fn get_libs_dir(app: &App) -> error::Result<String> {
    let libs_dir = app.path().resource_dir()?.join("libs");

    Ok(libs_dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // A plain #[test]: `teardown` blocks on Tauri's runtime, which panics inside another one.
    #[test]
    fn teardown_closes_the_pool_and_removes_the_wal_files() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("rook-reader-test.db");
        let wal = dir.path().join("rook-reader-test.db-wal");
        let shm = dir.path().join("rook-reader-test.db-shm");

        let pool = tauri::async_runtime::block_on(connect_database(&db_path))
            .expect("open the test database");
        // The migrations wrote through the WAL, so both files exist while the pool is open.
        assert!(
            wal.exists(),
            "the -wal file should exist while the pool is open"
        );
        assert!(
            shm.exists(),
            "the -shm file should exist while the pool is open"
        );

        let app = tauri::test::mock_app();
        app.manage(pool);
        teardown(app.handle());

        // Closing the last connection checkpoints the WAL and deletes both files.
        assert!(
            !wal.exists(),
            "the -wal file should be removed after teardown"
        );
        assert!(
            !shm.exists(),
            "the -shm file should be removed after teardown"
        );
    }
}
