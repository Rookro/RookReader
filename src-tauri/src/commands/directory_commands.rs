use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::read_dir;
use std::time::Instant;
use tauri::ipc::{Channel, Response};

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
pub async fn get_entries_in_dir(dir_path: String) -> Result<Response> {
    log::debug!("Get the directory entries in {}", dir_path);
    let start = Instant::now();
    let mut buffer = Vec::new();
    for entry in read_dir(dir_path)? {
        let entry = entry?;
        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_e| Error::Path("failed to get file name from DirEntry.".to_string()))?;
        let file_type = entry.file_type()?;
        let last_modified = entry.metadata()?.modified()?;
        let since_epoch = last_modified
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let timestamp_millis = since_epoch.as_millis() as i64;

        if (file_type.is_file() && <dyn Container>::is_supported_format(&file_name))
            || file_type.is_dir()
        {
            // is_directory (1 byte)
            buffer.push(if file_type.is_dir() { 1 } else { 0 });

            // name (len: 4 bytes + content)
            let name_bytes = file_name.as_bytes();
            buffer.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
            buffer.extend_from_slice(name_bytes);

            // last_modified (8 bytes)
            buffer.extend_from_slice(&timestamp_millis.to_be_bytes());
        }
    }

    log::debug!(
        "Elapsed time get the directory entries: {}",
        start.elapsed().as_millis()
    );
    Ok(Response::new(buffer))
}

// チャンクサイズ（1回に送るエントリー数。環境に合わせて調整してください）
const CHUNK_SIZE: usize = 2000;

#[tauri::command]
pub async fn get_entries_stream(dir_path: String, on_event: Channel<Vec<u8>>) -> Result<()> {
    log::debug!("Start streaming directory entries in {}", dir_path);

    let mut buffer = Vec::new();
    let mut count = 0;

    let entries = read_dir(&dir_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry?;
        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_e| Error::Path("failed to get file name from DirEntry.".to_string()))?;
        let file_type = entry.file_type()?;
        let last_modified = entry.metadata()?.modified()?;
        let since_epoch = last_modified
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let timestamp_millis = since_epoch.as_millis() as i64;

        // 条件フィルタ（適宜調整）
        let is_dir = file_type.is_dir();
        // ここでは単純化のためすべてのファイル/ディレクトリを送る前提にします

        // 1. is_directory (1 byte)
        buffer.push(if is_dir { 1 } else { 0 });

        // 2. name length (4 bytes) + name content
        let name_bytes = file_name.as_bytes();
        buffer.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
        buffer.extend_from_slice(name_bytes);

        // 3. timestamp (8 bytes)
        buffer.extend_from_slice(&timestamp_millis.to_be_bytes());

        count += 1;

        // 指定件数溜まったら送信してバッファをクリア
        if count >= CHUNK_SIZE {
            // Channelを通じて送信
            on_event.send(buffer.clone())?;
            buffer.clear();
            count = 0;
        }
    }

    // ループ終了後、残りのバッファがあれば送信
    if !buffer.is_empty() {
        let _ = on_event.send(buffer);
    }

    log::debug!("Finished streaming");
    Ok(())
}

/*
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_get_entries_in_dir_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_with_subdirectory() {
        let temp_dir = TempDir::new().unwrap();
        let sub_dir_path = temp_dir.path().join("subdir");
        fs::create_dir(&sub_dir_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_directory);
        assert_eq!(entries[0].name, "subdir");
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_with_supported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert!(entries
            .iter()
            .any(|e| e.name == "test.zip" && !e.is_directory));
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_with_unsupported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        let entries = result.unwrap();
        // Unsupported files should be filtered out
        assert!(!entries.iter().any(|e| e.name == "test.txt"));
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_nonexistent_directory() {
        let result = get_entries_in_dir("/nonexistent/path/that/does/not/exist".to_string()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_dir_entry_serialization() {
        let entry = DirEntry {
            is_directory: true,
            name: "test_dir".to_string(),
            last_modified: "2024-01-01T00:00:00+00:00".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("test_dir"));
        assert!(json.contains("true"));
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_mixed_content() {
        let temp_dir = TempDir::new().unwrap();

        // Create subdirectory
        fs::create_dir(temp_dir.path().join("dir1")).unwrap();

        // Create supported file
        fs::File::create(temp_dir.path().join("archive.zip")).unwrap();

        // Create unsupported file
        fs::File::create(temp_dir.path().join("document.txt")).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        let entries = result.unwrap();

        // Should contain directory and zip file, but not txt file
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|e| e.is_directory && e.name == "dir1"));
        assert!(entries
            .iter()
            .any(|e| !e.is_directory && e.name == "archive.zip"));
    }

    #[tokio::test]
    async fn test_dir_entry_last_modified_format() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().to_string()).await;

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
*/
