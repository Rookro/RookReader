use tauri::{
    menu::{CheckMenuItemBuilder, Menu, MenuBuilder, SubmenuBuilder},
    App, Wry,
};

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.set_menu(create_menu(app)?)?;
            set_menu_event(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::zip_commands::get_binary,
            commands::zip_commands::get_entries_in_zip,
            commands::file_commands::get_entries_in_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn create_menu(app: &App) -> tauri::Result<Menu<Wry>> {
    let file_menu = SubmenuBuilder::new(app, "File")
        .text("exit", "Exit")
        .build()?;

    let check_sub_item_1 = CheckMenuItemBuilder::new("Light")
        .id("light_theme")
        .checked(false)
        .build(app)?;

    let check_sub_item_2 = CheckMenuItemBuilder::new("Dark")
        .id("dark_theme")
        .checked(false)
        .build(app)?;

    let other_item = SubmenuBuilder::with_id(app, "theme", "Theme")
        .item(&check_sub_item_1)
        .item(&check_sub_item_2)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &other_item])
        .build()?;

    return Ok(menu);
}

fn set_menu_event(app: &App) {
    app.on_menu_event(
        move |app_handle: &tauri::AppHandle, event| match event.id().0.as_str() {
            "light_theme" => {
                let _ = app_handle
                    .menu()
                    .unwrap()
                    .get("theme")
                    .unwrap()
                    .as_submenu()
                    .unwrap()
                    .get("dark_theme")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(false);

                let _ = app_handle
                    .menu()
                    .unwrap()
                    .get("theme")
                    .unwrap()
                    .as_submenu()
                    .unwrap()
                    .get("light_theme")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(true);

                app_handle.set_theme(Some(tauri::Theme::Light));
            }
            "dark_theme" => {
                let _ = app_handle
                    .menu()
                    .unwrap()
                    .get("theme")
                    .unwrap()
                    .as_submenu()
                    .unwrap()
                    .get("light_theme")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(false);

                let _ = app_handle
                    .menu()
                    .unwrap()
                    .get("theme")
                    .unwrap()
                    .as_submenu()
                    .unwrap()
                    .get("dark_theme")
                    .unwrap()
                    .as_check_menuitem()
                    .unwrap()
                    .set_checked(true);

                app_handle.set_theme(Some(tauri::Theme::Dark));
            }
            "exit" => {
                app_handle.exit(0);
            }
            _ => {
                println!("unexpected menu event. menu event: {:?}", event.id());
            }
        },
    );
}
