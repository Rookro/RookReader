use std::sync::Mutex;

use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

mod commands;
mod container;
pub mod database;
mod error;
mod settings;
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
            if let Err(e) = setup::setup(app) {
                app.dialog()
                    .message(format!("Initialization failed.\nDetails: {}", e))
                    .kind(MessageDialogKind::Error)
                    .title("Rook Reader - Startup Error")
                    .blocking_show();
                return Err(e.into());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::directory_commands::get_entries_in_dir,
            commands::container_commands::get_image,
            commands::container_commands::get_image_preview,
            commands::container_commands::get_entries_in_container,
            commands::container_commands::set_pdf_render_resolution_height,
            commands::container_commands::set_max_image_height,
            commands::container_commands::set_image_resampling_method,
            commands::container_commands::determine_epub_novel,
            commands::font_commands::get_fonts,
            commands::book_commands::get_book_tags,
            commands::book_commands::update_book_tags,
            commands::book_commands::get_book,
            commands::book_commands::get_book_by_path,
            commands::book_commands::get_book_with_state_by_id,
            commands::book_commands::upsert_book,
            commands::book_commands::upsert_read_book,
            commands::book_commands::delete_book,
            commands::book_commands::clear_reading_history,
            commands::book_commands::clear_all_reading_history,
            commands::book_commands::get_recently_read_books,
            commands::book_commands::upsert_reading_state,
            commands::book_commands::get_all_books_with_state,
            commands::book_commands::get_books_with_state_by_bookshelf_id,
            commands::book_commands::get_books_with_state_by_tag_id,
            commands::book_commands::get_books_with_state_by_series_id,
            commands::bookshelf_commands::create_bookshelf,
            commands::bookshelf_commands::get_all_bookshelves,
            commands::bookshelf_commands::add_book_to_bookshelf,
            commands::bookshelf_commands::remove_book_from_bookshelf,
            commands::bookshelf_commands::delete_bookshelf,
            commands::series_commands::create_series,
            commands::series_commands::get_all_series,
            commands::tag_commands::create_tag,
            commands::tag_commands::get_all_tags,
            commands::tag_commands::delete_tag,
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
