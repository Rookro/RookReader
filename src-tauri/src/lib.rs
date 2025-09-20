use tauri::{
    menu::{CheckMenuItemBuilder, Menu, MenuBuilder, SubmenuBuilder},
    App, Manager, Wry,
};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_os::platform;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .format(|out, message, record| {
                    out.finish(format_args!(
                        "[{}] [{}] [{}::L{}] {}",
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
                .rotation_strategy(RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.set_menu(create_menu(app)?)?;
            set_menu_event(app);
            setup_pdfium(&get_libs_dir(app)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_commands::get_image,
            commands::file_commands::get_entries_in_container,
            commands::file_commands::get_entries_in_dir,
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

                log::debug!("Set the Light theme.");
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

                log::debug!("Set the Dark theme.");
                app_handle.set_theme(Some(tauri::Theme::Dark));
            }
            "exit" => {
                log::debug!("Exit by menu.");
                app_handle.exit(0);
            }
            _ => {
                log::error!("unexpected menu event. menu event: {:?}", event.id());
            }
        },
    );
}

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

fn setup_pdfium(lib_dir: &String) {
    pdfium::set_library_location(lib_dir);
}
