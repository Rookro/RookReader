use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::read_dir;

use crate::container::container::Container;

/// A directory entry.
#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    /// Whether it is a directory.
    pub is_directory: bool,
    /// The name.
    pub name: String,
    /// The last modified date in RFC 3339 format.
    pub last_modified: String,
}

/// Gets entries in the specified directory.
///
/// * `dir_path` - The path of the directory to get.
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

        if (file_type.is_file() && <dyn Container>::is_supported_format(&file_name))
            || file_type.is_dir()
        {
            entries.push(DirEntry {
                is_directory: file_type.is_dir(),
                name: file_name,
                last_modified: last_modified_time.to_rfc3339(),
            });
        }
    }

    Ok(entries)
}
