use crate::error;
use std::sync::Mutex;
use tauri::{App, Manager};

/// Gets the libs directory path.
///
/// * `app` - App instance of Tauri.
fn get_libs_dir(app: &App) -> error::Result<String> {
    let libs_dir = app.path().resource_dir()?.join("libs");

    Ok(libs_dir.to_string_lossy().to_string())
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
