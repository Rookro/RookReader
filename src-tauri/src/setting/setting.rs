use tauri::{App, Theme};
use tauri_plugin_store::StoreExt;

pub fn load(app: &App) {
    let setting_file_path = "rook-reader_settings.json";
    let store = match app.store(setting_file_path) {
        Ok(store) => store,
        Err(_) => {
            log::error!("Failed to load setting file.");
            return;
        }
    };

    // テーマ設定
    if let Some(theme) = store
        .get("theme")
        .unwrap_or(serde_json::Value::Null)
        .as_str()
    {
        match theme {
            "dark" => app.set_theme(Some(Theme::Dark)),
            "light" => app.set_theme(Some(Theme::Light)),
            _ => app.set_theme(None),
        }
    }
}
