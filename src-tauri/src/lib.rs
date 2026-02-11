use std::sync::Mutex;

use crate::setting::setting::Settings;

mod commands;
mod container;
mod error;
mod setting;
mod setup;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(Mutex::new(state::app_state::AppState::default()))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let settings = Settings::load(app, "rook-reader_settings.json")?;
            setup::setup(app, &settings)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::directory_commands::get_entries_in_dir,
            commands::container_commands::get_image,
            commands::container_commands::get_entries_in_container,
            commands::container_commands::set_pdf_rendering_height,
            commands::container_commands::set_max_image_height,
            commands::container_commands::set_image_resize_method,
            commands::container_commands::determine_epub_novel,
            commands::font_commands::get_fonts,
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
