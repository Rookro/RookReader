use std::fs::read_dir;
use tauri::ipc::{Channel, Response};

use crate::container::container::Container;
use crate::error::{Error, Result};

/// Chank size.
const CHUNK_SIZE: usize = 200;

/// Streams directory entries to the frontend in chunks.
///
/// This function reads a directory and sends its entries to the frontend over a Tauri channel.
/// It filters for subdirectories and supported file formats. Entries are buffered and sent
/// in chunks of `CHUNK_SIZE`.
///
/// The binary format for each entry is identical to `get_entries_in_dir`:
/// \[is_directory (1 bytes)\]\[name_len (4 bytes)\]\[name (`name_len` bytes)\]\[last_modified (8 bytes))\]
///
/// Returns an empty `Result` on success, or an `Error` if reading the directory or sending
/// data fails.
///
/// * `dir_path` - The path to the directory to stream.
/// * `channel` - The Tauri channel used to send data chunks (`ipc::Response`) to the frontend.
#[tauri::command]
pub async fn stream_entries_in_dir(dir_path: String, channel: Channel<Response>) -> Result<()> {
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
        let last_modified_timestamp_ms = since_epoch.as_millis() as u64;

        if file_type.is_file() && !<dyn Container>::is_supported_format(&file_name) {
            // Unsupported file, skip
            continue;
        }

        // is_directory (1 byte)
        buffer.push(if file_type.is_dir() { 1 } else { 0 });

        // name length (4 bytes) + name content
        let name_bytes = file_name.as_bytes();
        buffer.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
        buffer.extend_from_slice(name_bytes);

        // timestamp (8 bytes)
        buffer.extend_from_slice(&last_modified_timestamp_ms.to_be_bytes());

        count += 1;

        if count >= CHUNK_SIZE {
            channel.send(Response::new(buffer.clone()))?;
            buffer.clear();
            count = 0;
        }
    }

    if !buffer.is_empty() {
        channel.send(Response::new(buffer))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::DateTime;
    use std::convert::TryInto;
    use std::fs;
    use std::sync::{Arc, Mutex};
    use tauri::ipc::Channel;
    use tempfile::TempDir;

    // The `DirEntry` struct is used for testing purposes to represent the parsed binary data.
    #[derive(Debug, PartialEq, Eq, Clone)]
    struct TestDirEntry {
        pub is_directory: bool,
        pub name: String,
        pub last_modified: i64,
    }

    // Helper function to parse the binary buffer
    fn parse_entries(buffer: &[u8]) -> Vec<TestDirEntry> {
        let mut entries = Vec::new();
        let mut cursor = 0;

        while cursor < buffer.len() {
            // is_directory (1 byte)
            let is_directory = buffer[cursor] == 1;
            cursor += 1;

            // name (len: 4 bytes + content)
            let name_len =
                u32::from_be_bytes(buffer[cursor..cursor + 4].try_into().unwrap()) as usize;
            cursor += 4;
            let name = String::from_utf8(buffer[cursor..cursor + name_len].to_vec()).unwrap();
            cursor += name_len;

            // last_modified (8 bytes)
            let last_modified = i64::from_be_bytes(buffer[cursor..cursor + 8].try_into().unwrap());
            cursor += 8;

            entries.push(TestDirEntry {
                is_directory,
                name,
                last_modified,
            });
        }

        entries
    }

    fn get_mock_channel() -> (Channel<Response>, Arc<Mutex<Vec<u8>>>) {
        let received_data = Arc::new(Mutex::new(Vec::new()));
        let received_data_clone = Arc::clone(&received_data);

        let channel = Channel::new(move |event| {
            if let tauri::ipc::InvokeResponseBody::Raw(raw) = event {
                received_data_clone.lock().unwrap().extend(raw);
            }
            Ok(())
        });

        return (channel, received_data);
    }

    #[tokio::test]
    async fn test_stream_entries_in_dir_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let (channel, received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir(temp_dir.path().to_string_lossy().to_string(), channel).await;

        assert!(result.is_ok());
        let received_data = received_data_mutex.lock().unwrap();
        assert!(received_data.is_empty());
    }

    #[tokio::test]
    async fn test_stream_entries_in_dir_with_subdirectory() {
        let temp_dir = TempDir::new().unwrap();
        let sub_dir_path = temp_dir.path().join("subdir");
        fs::create_dir(&sub_dir_path).unwrap();
        let (channel, received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir(temp_dir.path().to_string_lossy().to_string(), channel).await;

        assert!(result.is_ok());
        let received_data = received_data_mutex.lock().unwrap();
        let entries = parse_entries(&received_data);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_directory);
        assert_eq!(entries[0].name, "subdir");
    }

    #[tokio::test]
    async fn test_stream_entries_in_dir_with_supported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        fs::File::create(&file_path).unwrap();
        let (channel, received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir(temp_dir.path().to_string_lossy().to_string(), channel).await;

        assert!(result.is_ok());
        let received_data = received_data_mutex.lock().unwrap();
        let entries = parse_entries(&received_data);
        assert_eq!(entries.len(), 1);
        assert!(!entries[0].is_directory);
        assert_eq!(entries[0].name, "test.zip");
    }

    #[tokio::test]
    async fn test_stream_entries_in_dir_with_unsupported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::File::create(&file_path).unwrap();
        let (channel, received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir(temp_dir.path().to_string_lossy().to_string(), channel).await;

        assert!(result.is_ok());
        let received_data = received_data_mutex.lock().unwrap();
        let entries = parse_entries(&received_data);
        // Unsupported files should be filtered out
        assert!(!entries.iter().any(|e| e.name == "test.txt"));
    }

    #[tokio::test]
    async fn test_stream_entries_in_dir_nonexistent_directory() {
        let (channel, _received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir("/nonexistent/path/that/does/not/exist".to_string(), channel)
                .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_stream_entries_in_dir_mixed_content() {
        let temp_dir = TempDir::new().unwrap();
        fs::create_dir(temp_dir.path().join("dir1")).unwrap();
        // Create supported file
        fs::File::create(temp_dir.path().join("archive.zip")).unwrap();
        // Create unsupported file
        fs::File::create(temp_dir.path().join("document.txt")).unwrap();

        let (channel, received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir(temp_dir.path().to_string_lossy().to_string(), channel).await;

        assert!(result.is_ok());
        let received_data = received_data_mutex.lock().unwrap();
        let entries = parse_entries(&received_data);

        // Should contain directory and zip file, but not txt file
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|e| e.is_directory && e.name == "dir1"));
        assert!(entries
            .iter()
            .any(|e| !e.is_directory && e.name == "archive.zip"));
        assert!(!entries
            .iter()
            .any(|e| !e.is_directory && e.name == "document.txt"));
    }

    #[tokio::test]
    async fn test_stream_dir_entry_last_modified_format() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        let file = fs::File::create(&file_path).unwrap();
        let expected_last_modified = file
            .metadata()
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        let (channel, received_data_mutex) = get_mock_channel();

        let result =
            stream_entries_in_dir(temp_dir.path().to_string_lossy().to_string(), channel).await;

        assert!(result.is_ok());
        let received_data = received_data_mutex.lock().unwrap();
        let entries = parse_entries(&received_data);
        assert!(!entries.is_empty());

        // Check last modified timestamp.
        for entry in entries {
            assert_eq!(expected_last_modified, entry.last_modified);
            let parsed = DateTime::from_timestamp_millis(entry.last_modified);
            assert!(parsed.is_some(), "last_modified is invalid.");
        }
    }
}
