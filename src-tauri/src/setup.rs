use chrono::Local;
use image::imageops::FilterType;
use log::debug;
use std::sync::Mutex;
use tauri::{App, Manager, Theme};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

use crate::{
    error,
    setting::{app_theme::AppTheme, core::Settings, log_settings::LogSettings},
};

/// Orchestrates the initial setup of the application.
///
/// This function is the main entry point for configuring the app at startup. It initializes
/// the logger, sets the application theme, and configures container-related settings.
///
/// # Arguments
///
/// * `app` - A reference to the Tauri `App` instance.
/// * `settings` - The application's loaded settings.
///
/// # Errors
///
/// Returns an `Err` if any of the setup sub-routines (e.g., logger setup) fail.
pub fn setup(app: &App, settings: &Settings) -> error::Result<()> {
    setup_logger(app, &settings.log)?;
    set_theme(app, &settings.theme);

    setup_container_settings(app, settings)?;

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
/// Returns a `Mutex` error if the application state cannot be locked.
pub fn setup_container_settings(app: &App, settings: &Settings) -> error::Result<()> {
    let state: tauri::State<'_, Mutex<crate::state::app_state::AppState>> = app.state();
    let mut locked_state = state
        .lock()
        .map_err(|e| error::Error::Mutex(format!("Failed to get app state. Error: {}", e)))?;

    locked_state.container_state.settings.pdfium_library_path = Some(get_libs_dir(app)?);
    locked_state.container_state.settings.enable_preview = settings.rendering.enable_preview;
    locked_state.container_state.settings.max_image_height = settings.rendering.max_image_height;
    locked_state.container_state.settings.image_resize_method =
        match settings.rendering.image_resize_method.as_str() {
            "nearest" => FilterType::Nearest,
            "triangle" => FilterType::Triangle,
            "catmullRom" => FilterType::CatmullRom,
            "gaussian" => FilterType::Gaussian,
            "lanczos3" => FilterType::Lanczos3,
            _ => FilterType::Triangle,
        };
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
    // Set log level to INFO for specific libraries to reduce noise.
    let override_log_level =
        if settings.level == log::LevelFilter::Debug || settings.level == log::LevelFilter::Trace {
            log::LevelFilter::Info
        } else {
            settings.level
        };

    app.handle().plugin(
        tauri_plugin_log::Builder::new()
            .level(settings.level)
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

/// Helper function to locate the directory containing bundled dynamic libraries.
fn get_libs_dir(app: &App) -> error::Result<String> {
    let libs_dir = app.path().resource_dir()?.join("libs");

    Ok(libs_dir.to_string_lossy().to_string())
}
