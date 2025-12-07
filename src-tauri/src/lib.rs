use std::sync::Mutex;

use chrono::Local;
use tauri::{App, Manager};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_os::platform;

mod commands;
mod container;
mod setting;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(Mutex::new(state::app_state::AppState::default()))
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
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
                .rotation_strategy(RotationStrategy::KeepSome(10))
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            setting::setting::load(app);
            setup_container_settings(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::directory_commands::get_entries_in_dir,
            commands::container_commands::get_image,
            commands::container_commands::get_entries_in_container,
            commands::container_commands::set_pdf_rendering_height,
        ])
        .run(tauri::generate_context!());

    match result {
        Ok(()) => {}
        Err(e) => log::error!(
            "Error has occurred while running tauri application. Error: {}",
            e.to_string()
        ),
    };
}

/// Gets the libs directory path.
///
/// * `app` - App instance of Tauri.
fn get_libs_dir(app: &App) -> Result<String, String> {
    let platform = platform();
    match platform {
        "linux" => {
            let mut libs_dir = app.path().resource_dir().unwrap();
            libs_dir.push("libs");
            return Ok(libs_dir
                .to_str()
                .ok_or("Failed to convert PathBuf to string".to_string())?
                .to_string());
        }
        "windows" => {
            let mut libs_dir = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .parent()
                .ok_or("Failed to get exec dir path.")?
                .to_path_buf();
            libs_dir.push("libs");
            return Ok(libs_dir
                .to_str()
                .ok_or("Failed to convert PathBuf to string".to_string())?
                .to_string());
        }
        _ => {
            log::error!("Unsupported OS: {}", platform);
            return Err(format!("Unsupported OS: {}", platform).to_string());
        }
    }
}

/// Sets up the direcotry path of PDFium library.
///
/// * `app` - App instance of Tauri.
fn setup_container_settings(app: &App) -> Result<(), String> {
    let state: tauri::State<'_, Mutex<state::app_state::AppState>> = app.state();
    let mut locked_state = state
        .lock()
        .map_err(|e| format!("Failed to get app state. Error: {}", e))?;

    locked_state.container_state.settings.pdfium_library_path = Some(get_libs_dir(app)?);
    Ok(())
}
