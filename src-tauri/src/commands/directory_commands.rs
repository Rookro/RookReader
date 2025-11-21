use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::read_dir;

/// ディレクトリーエントリー
#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    /// ディレクトリーかどうか
    pub is_directory: bool,
    /// 名前
    pub name: String,
    /// 最終更新日時 (RFC 3339 形式)
    pub last_modified: String,
}

/// 指定されたディレクトリー内のエントリーを取得する
///
/// * `dir_path` - 取得するディレクトリーのパス
#[tauri::command()]
pub fn get_entries_in_dir(dir_path: String) -> Result<Vec<DirEntry>, String> {
    log::debug!("Get the directory entries in {}", dir_path);
    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_e| "failed to get file name from DirEntry.")?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let last_modified = entry
            .metadata()
            .map_err(|e| e.to_string())?
            .modified()
            .map_err(|e| e.to_string())?;

        let last_modified_time: DateTime<Utc> = last_modified.into();

        entries.push(DirEntry {
            is_directory: file_type.is_dir(),
            name: file_name,
            last_modified: last_modified_time.to_rfc3339(),
        });
    }

    Ok(entries)
}
