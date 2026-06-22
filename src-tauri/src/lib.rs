use tokio::sync::RwLock;

use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_specta::{collect_commands, Builder};

mod commands;
mod container;
pub mod domain;
pub mod error;
pub mod image;
pub mod infrastructure;
mod settings;
mod setup;
mod state;

/// Builds the `tauri-specta` command registry used to export the TypeScript bindings.
///
/// This intentionally excludes the three binary commands (`get_image`,
/// `get_image_preview`, `get_entries_in_dir`) that return a raw
/// `tauri::ipc::Response`: that type has no `specta::Type`, and the frontend keeps
/// hand-written wrappers for them. At runtime [`run`] serves every command listed
/// here through this builder's invoke handler and routes only those three binary
/// commands to a small separate `tauri::generate_handler!`.
///
/// # Returns
///
/// A `tauri_specta::Builder` configured with every specta-compatible command.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::settings_commands::get_settings,
        commands::settings_commands::set_settings,
        commands::container_commands::request_preload_around,
        commands::container_commands::get_entries_in_container,
        commands::font_commands::get_fonts,
        commands::book_commands::get_book_tags,
        commands::book_commands::update_book_tags::<tauri::Wry>,
        commands::book_commands::get_book,
        commands::book_commands::get_book_by_path,
        commands::book_commands::get_book_with_state_by_id,
        commands::book_commands::register_book::<tauri::Wry>,
        commands::book_commands::record_book_opened::<tauri::Wry>,
        commands::book_commands::delete_book::<tauri::Wry>,
        commands::book_commands::clear_reading_history::<tauri::Wry>,
        commands::book_commands::clear_all_reading_history::<tauri::Wry>,
        commands::book_commands::get_recently_read_books,
        commands::book_commands::update_reading_progress::<tauri::Wry>,
        commands::book_commands::get_all_books_with_state,
        commands::book_commands::get_books_with_state_by_bookshelf_id,
        commands::book_commands::get_books_with_state_by_tag_id,
        commands::book_commands::get_books_with_state_by_series_id,
        commands::book_commands::update_book_series::<tauri::Wry>,
        commands::book_commands::update_series_orders::<tauri::Wry>,
        commands::bookshelf_commands::create_bookshelf::<tauri::Wry>,
        commands::bookshelf_commands::get_all_bookshelves,
        commands::bookshelf_commands::add_book_to_bookshelf::<tauri::Wry>,
        commands::bookshelf_commands::remove_book_from_bookshelf::<tauri::Wry>,
        commands::bookshelf_commands::delete_bookshelf::<tauri::Wry>,
        commands::series_commands::create_series::<tauri::Wry>,
        commands::series_commands::get_all_series,
        commands::series_commands::delete_series::<tauri::Wry>,
        commands::tag_commands::create_tag::<tauri::Wry>,
        commands::tag_commands::get_all_tags,
        commands::tag_commands::delete_tag::<tauri::Wry>,
        commands::updater_commands::is_updater_supported,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The full command list lives in exactly one place: `specta_builder`. Its
    // generated invoke handler serves every specta-compatible command.
    let specta_handler = specta_builder().invoke_handler();

    // The binary commands return a raw `tauri::ipc::Response` (no `specta::Type`),
    // so they can't be registered with the tauri-specta builder. They keep a tiny
    // hand-written handler and are routed to it by command name; everything else
    // falls through to the generated handler above. Keep this list in sync with the
    // `generate_handler!` invocation below — both are the single, small binary set.
    const BINARY_COMMANDS: [&str; 3] = ["get_image", "get_image_preview", "get_entries_in_dir"];
    let binary_handler = tauri::generate_handler![
        commands::container_commands::get_image,
        commands::container_commands::get_image_preview,
        commands::directory_commands::get_entries_in_dir,
    ] as fn(tauri::ipc::Invoke<tauri::Wry>) -> bool;

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(RwLock::new(state::app_state::AppState::default()))
        .manage(settings::SettingsFileLock::default())
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
        .invoke_handler(move |invoke| {
            if BINARY_COMMANDS.contains(&invoke.message.command()) {
                binary_handler(invoke)
            } else {
                specta_handler(invoke)
            }
        })
        .run(tauri::generate_context!());

    match result {
        Ok(()) => {}
        Err(e) => log::error!(
            "Error has occurred while running tauri application. Error: {}",
            e
        ),
    };
}

#[cfg(test)]
mod bindings_export {
    use specta_typescript::Typescript;

    /// Regenerates `src/bindings/bindings.ts` from the Rust command definitions.
    ///
    /// Run via `npm run gen:bindings`. CI re-runs this and fails if the working
    /// tree differs, guaranteeing the committed bindings match the backend.
    #[test]
    fn export_bindings() {
        crate::specta_builder()
            // i64/u64 IDs are cast to TS `number` (the long-standing behavior).
            // specta-typescript forbids large integers by default to avoid precision
            // loss; our IDs stay well within `Number.MAX_SAFE_INTEGER`.
            .dangerously_cast_bigints_to_number()
            .export(
                // The generated file contains internal helpers (`TAURI_CHANNEL`,
                // `__makeEvents__`) that are unused here; `@ts-nocheck` silences strict
                // unused-symbol errors while keeping the exported types usable at call sites.
                Typescript::default().header("// @ts-nocheck\n"),
                "../src/bindings/bindings.ts",
            )
            .expect("failed to export TypeScript bindings");

        // Guard against an accidental command/type drop: assert the generated file
        // contains representative command names and key types. This fails the test
        // directly rather than only surfacing via the CI drift check.
        let generated = std::fs::read_to_string("../src/bindings/bindings.ts")
            .expect("generated bindings file should exist");
        assert!(!generated.trim().is_empty(), "bindings.ts is empty");
        for needle in [
            "getSettings",
            "setSettings",
            "get_settings",
            "set_settings",
            "registerBook",
            "register_book",
            "export type AppSettings",
            "export type BookWithState",
            // Structured settings-validation error shape surfaced to the frontend.
            "SettingsValidationViolation",
            "ViolationKind",
            "details",
        ] {
            assert!(generated.contains(needle), "bindings.ts missing `{needle}`");
        }

        // The granular container setters were folded into `set_settings`
        // (apply_reader_settings_to_container) and must no longer be generated.
        for absent in [
            "set_pdf_render_resolution_height",
            "set_max_image_height",
            "set_image_resampling_method",
            "set_image_cache_size_mib",
        ] {
            assert!(
                !generated.contains(absent),
                "bindings.ts still contains removed command `{absent}`"
            );
        }
    }
}

#[cfg(test)]
mod serialization_round_trip {
    use crate::domain::book::entity::{Book, BookWithState};
    use crate::domain::series::entity::Series;
    use crate::domain::tag::entity::Tag;
    use crate::settings::AppSettings;

    #[test]
    fn app_settings_uses_camel_case_and_round_trips() {
        let original = AppSettings::default();
        let value = serde_json::to_value(&original).unwrap();

        // `rename_all = "camelCase"` is what the generated TS types assume.
        assert!(value.get("fileNavigator").is_some());
        assert!(value["reader"]["rendering"]
            .get("imageResamplingMethod")
            .is_some());
        // snake_case enum tag (e.g. reading direction "rtl").
        assert_eq!(value["reader"]["comic"]["readingDirection"], "rtl");

        let back: AppSettings = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&back).unwrap(), value);
    }

    #[test]
    fn book_round_trips_with_snake_case_keys() {
        let book = Book {
            id: 1,
            file_path: "p".into(),
            item_type: "file".into(),
            display_name: "n".into(),
            total_pages: 3,
            series_id: None,
            series_order: None,
            thumbnail_path: None,
        };
        let value = serde_json::to_value(&book).unwrap();
        assert!(value.get("file_path").is_some());
        let back: Book = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&back).unwrap(), value);
    }

    #[test]
    fn book_with_state_omits_skipped_field_and_round_trips() {
        let book = BookWithState {
            id: 1,
            file_path: "p".into(),
            item_type: "file".into(),
            display_name: "n".into(),
            total_pages: 3,
            series_id: None,
            series_order: None,
            thumbnail_path: None,
            last_read_page_index: Some(2),
            last_opened_at: None,
            tag_ids_str: Some("1,2".into()),
            tag_ids: vec![1, 2],
        };
        let value = serde_json::to_value(&book).unwrap();
        // `tag_ids_str` is `#[serde(skip)]` and must not appear on the wire.
        assert!(value.get("tag_ids_str").is_none());
        assert!(value.get("tag_ids").is_some());
        let back: BookWithState = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&back).unwrap(), value);
    }

    #[test]
    fn tag_round_trips() {
        let tag = Tag {
            id: 7,
            name: "fantasy".into(),
            color_code: "#FF0000".into(),
        };
        let value = serde_json::to_value(&tag).unwrap();
        let back: Tag = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&back).unwrap(), value);
    }

    #[test]
    fn series_round_trips_with_datetime() {
        let created_at = chrono::NaiveDate::from_ymd_opt(2020, 1, 2)
            .unwrap()
            .and_hms_opt(3, 4, 5)
            .unwrap();
        let series = Series {
            id: 9,
            name: "saga".into(),
            created_at,
        };
        let value = serde_json::to_value(&series).unwrap();
        assert!(value.get("created_at").is_some());
        let back: Series = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&back).unwrap(), value);
    }
}
