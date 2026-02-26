use std::sync::Mutex;

use crate::setting::core::Settings;

mod commands;
mod container;
mod database;
mod error;
mod setting;
mod setup;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(state::app_state::AppState::default()))
        .setup(|app| {
            let settings = Settings::load(app, "rook-reader_settings.json")?;
            setup::setup(app, &settings)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::directory_commands::get_entries_in_dir,
            commands::container_commands::get_image,
            commands::container_commands::get_image_preview,
            commands::container_commands::get_entries_in_container,
            commands::container_commands::set_pdf_rendering_height,
            commands::container_commands::set_max_image_height,
            commands::container_commands::set_image_resize_method,
            commands::container_commands::determine_epub_novel,
            commands::font_commands::get_fonts,
            commands::history_commands::upsert_history,
            commands::history_commands::get_all_history,
            commands::history_commands::get_latest_history,
            commands::history_commands::get_history,
            commands::history_commands::delete_history,
            commands::history_commands::delete_all_history,
        ])
        .run(tauri::generate_context!());

    match result {
        Ok(()) => {}
        Err(e) => log::error!(
            "Error has occurred while running tauri application. Error: {}",
            e
        ),
    };
}
