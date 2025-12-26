use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::read_dir;

use crate::container::container::Container;
use crate::error::{Error, Result};

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
pub fn get_entries_in_dir(dir_path: String) -> Result<Vec<DirEntry>> {
    log::debug!("Get the directory entries in {}", dir_path);
    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in read_dir(dir_path)? {
        let entry = entry?;
        let file_name = entry.file_name().into_string().map_err(|_e| {
            Error::Path("failed to get file name from DirEntry.".to_string())
        })?;
        let file_type = entry.file_type()?;
        let last_modified = entry.metadata()?.modified()?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_get_entries_in_dir_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string());

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_get_entries_in_dir_with_subdirectory() {
        let temp_dir = TempDir::new().unwrap();
        let sub_dir_path = temp_dir.path().join("subdir");
        fs::create_dir(&sub_dir_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string());

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_directory);
        assert_eq!(entries[0].name, "subdir");
    }

    #[test]
    fn test_get_entries_in_dir_with_supported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string());

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert!(entries
            .iter()
            .any(|e| e.name == "test.zip" && !e.is_directory));
    }

    #[test]
    fn test_get_entries_in_dir_with_unsupported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string());

        assert!(result.is_ok());
        let entries = result.unwrap();
        // Unsupported files should be filtered out
        assert!(!entries.iter().any(|e| e.name == "test.txt"));
    }

    #[test]
    fn test_get_entries_in_dir_nonexistent_directory() {
        let result = get_entries_in_dir("/nonexistent/path/that/does/not/exist".to_string());

        assert!(result.is_err());
    }

    #[test]
    fn test_dir_entry_serialization() {
        let entry = DirEntry {
            is_directory: true,
            name: "test_dir".to_string(),
            last_modified: "2024-01-01T00:00:00+00:00".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("test_dir"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_get_entries_in_dir_mixed_content() {
        let temp_dir = TempDir::new().unwrap();

        // Create subdirectory
        fs::create_dir(temp_dir.path().join("dir1")).unwrap();

        // Create supported file
        fs::File::create(temp_dir.path().join("archive.zip")).unwrap();

        // Create unsupported file
        fs::File::create(temp_dir.path().join("document.txt")).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string());

        assert!(result.is_ok());
        let entries = result.unwrap();

        // Should contain directory and zip file, but not txt file
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|e| e.is_directory && e.name == "dir1"));
        assert!(entries
            .iter()
            .any(|e| !e.is_directory && e.name == "archive.zip"));
    }

    #[test]
    fn test_dir_entry_last_modified_format() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string());

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert!(!entries.is_empty());

        // Check RFC 3339 format
        for entry in entries {
            let parsed = DateTime::parse_from_rfc3339(&entry.last_modified);
            assert!(parsed.is_ok(), "last_modified should be in RFC 3339 format");
        }
    }
}
