use std::fs::read_dir;
use tauri::ipc::Response;

use crate::container::traits::Container;
use crate::error::{Error, Result};

/// Reads the contents of a directory and returns a list of its entries.
///
/// This function scans a directory specified by `dir_path` and filters its contents,
/// returning only subdirectories and files with supported container formats (e.g., .zip, .cbz).
///
/// # Arguments
///
/// * `dir_path` - The path to the directory to be read.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `tauri::ipc::Response`. The response body uses a custom
/// binary format to encode a list of directory entries. Each entry is structured as follows:
///
/// * `is_directory` (1 byte): `1` if the entry is a directory, `0` if it is a file.
/// * `name_length` (4 bytes): The length of the entry's name as a Big-Endian `u32`.
/// * `name` (variable): The UTF-8 encoded name of the entry.
/// * `last_modified` (8 bytes): The last modified timestamp as a Big-Endian `u64`
///   (milliseconds since the UNIX epoch).
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The specified `dir_path` does not exist or cannot be read.
/// * An entry's file name contains invalid UTF-8.
/// * Filesystem metadata for an entry cannot be accessed.
#[tauri::command()]
pub async fn get_entries_in_dir(dir_path: &str) -> Result<Response> {
    log::debug!("Get the directory entries in {}", dir_path);
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
        let last_modified_timestamp_ms = since_epoch.as_millis() as u64;

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
            buffer.extend_from_slice(&last_modified_timestamp_ms.to_be_bytes());
        }
    }
    Ok(Response::new(buffer))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::DateTime;
    use std::convert::TryInto;
    use std::fs;
    use tauri::ipc::IpcResponse;
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

    // Helper to get bytes from tauri::ipc::Response
    fn get_bytes_from_response(response: tauri::ipc::Response) -> Vec<u8> {
        response.body().unwrap().deserialize::<Vec<u8>>().unwrap()
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        assert!(bytes.is_empty());
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_with_subdirectory() {
        let temp_dir = TempDir::new().unwrap();
        let sub_dir_path = temp_dir.path().join("subdir");
        fs::create_dir(&sub_dir_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_directory);
        assert_eq!(entries[0].name, "subdir");
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_with_supported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.zip");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);
        assert!(entries
            .iter()
            .any(|e| e.name == "test.zip" && !e.is_directory));
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_with_unsupported_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::File::create(&file_path).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);
        // Unsupported files should be filtered out
        assert!(!entries.iter().any(|e| e.name == "test.txt"));
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_nonexistent_directory() {
        let result = get_entries_in_dir("/nonexistent/path/that/does/not/exist").await;

        assert!(result.is_err());
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

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);

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

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);
        assert!(!entries.is_empty());

        // Check last modified timestamp.
        for entry in entries {
            let parsed = DateTime::from_timestamp_millis(entry.last_modified);
            assert!(
                parsed.is_some(),
                "last_modified should be in RFC 3339 format"
            );
        }
    }
}
