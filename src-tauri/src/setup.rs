use chrono::Local;
use std::sync::Mutex;
use tauri::{App, Manager, Theme};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

use crate::{
    error,
    setting::{app_theme::AppTheme, log_settings::LogSettings, setting::Settings},
};

/// Sets up the application.
///
/// * `app` - App instance of Tauri.
/// * `settings` - The settings to use.
pub fn setup(app: &App, settings: &Settings) -> error::Result<()> {
    setup_logger(app, &settings.log)?;
    set_theme(app, &settings.theme);

    setup_container_settings(app)?;
    Ok(())
}

/// Sets up the direcotry path of PDFium library.
///
/// * `app` - App instance of Tauri.
pub fn setup_container_settings(app: &App) -> error::Result<()> {
    let state: tauri::State<'_, Mutex<crate::state::app_state::AppState>> = app.state();
    let mut locked_state = state
        .lock()
        .map_err(|e| error::Error::Mutex(format!("Failed to get app state. Error: {}", e)))?;

    locked_state.container_state.settings.pdfium_library_path = Some(get_libs_dir(app)?);
    Ok(())
}

/// Sets up the logger for the application.
///
/// * `app` - App instance of Tauri.
/// * `settings` - The log settings to use.
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

/// Sets the theme for the application.
///
/// * `app` - App instance of Tauri.
/// * `app_theme` - The theme to set.
fn set_theme(app: &App, app_theme: &AppTheme) {
    let theme = match app_theme {
        AppTheme::Light => Some(Theme::Light),
        AppTheme::Dark => Some(Theme::Dark),
        AppTheme::System => None,
    };

    app.set_theme(theme);
}

/// Gets the libs directory path.
///
/// * `app` - App instance of Tauri.
fn get_libs_dir(app: &App) -> error::Result<String> {
    let libs_dir = app.path().resource_dir()?.join("libs");

    Ok(libs_dir.to_string_lossy().to_string())
}
