use std::fs::read_dir;
use std::path::Path;
use tauri::ipc::Response;

use crate::container::{archive_listing, archive_path, traits::Container};
use crate::error::Result;

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
///
/// # Note
///
/// `dir_path` may also name a browsable archive (`.zip`, `.cbz`, `.rar`, `.cbr`) or a
/// folder inside one, in which case the archive's folders at that level are returned.
/// Files inside an archive are never listed: only a folder inside an archive can be
/// opened as a book. The listing always mirrors the archive's real structure,
/// independently of the `autoDescendSingleFolder` setting, which governs opening only.
#[tauri::command()]
pub async fn get_entries_in_dir(dir_path: &str) -> Result<Response> {
    log::debug!("Get the directory entries in {}", dir_path);

    // Browsing inside an archive: either a folder within it, or the archive file itself
    // (its root). Real filesystem paths are matched first by `archive_path::resolve`.
    if let Some(location) = archive_path::resolve(dir_path) {
        return list_archive_dirs(&location.archive, &location.inner_dir);
    }
    let path = Path::new(dir_path);
    if path.is_file() && archive_path::is_navigable_archive(path) {
        return list_archive_dirs(path, "");
    }

    let mut buffer = Vec::new();
    for entry in read_dir(dir_path)? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                log::warn!("skipping unreadable directory entry: {e}");
                continue;
            }
        };
        let file_name = match entry.file_name().into_string() {
            Ok(file_name) => file_name,
            Err(os_name) => {
                // The name is valid on this OS but isn't representable as UTF-8, which
                // the response format requires. Skip it rather than failing the listing.
                log::warn!(
                    "skipping entry whose name could not be decoded as UTF-8: {}",
                    os_name.to_string_lossy()
                );
                continue;
            }
        };
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(e) => {
                log::warn!("skipping entry '{file_name}': failed to read file type: {e}");
                continue;
            }
        };
        let last_modified = match entry.metadata().and_then(|m| m.modified()) {
            Ok(modified) => modified,
            Err(e) => {
                log::warn!("skipping entry '{file_name}': failed to read metadata: {e}");
                continue;
            }
        };
        let since_epoch = last_modified
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let last_modified_timestamp_ms = since_epoch.as_millis() as u64;

        if (file_type.is_file() && <dyn Container>::is_supported_format(&file_name))
            || file_type.is_dir()
        {
            push_entry(
                &mut buffer,
                file_type.is_dir(),
                &file_name,
                last_modified_timestamp_ms,
            );
        }
    }
    Ok(Response::new(buffer))
}

/// Encodes an archive's child folders in the same binary record format as the
/// filesystem listing.
///
/// Every row carries the archive file's own modification time: a folder inside an
/// archive has no timestamp of its own, so date sorting falls back to the archive's.
///
/// # Arguments
///
/// * `archive` - The archive file on disk.
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// A `tauri::ipc::Response` holding the encoded folder rows.
///
/// # Errors
///
/// Returns an `Err` if the archive cannot be read.
fn list_archive_dirs(archive: &Path, inner_dir: &str) -> Result<Response> {
    let last_modified_timestamp_ms = archive
        .metadata()
        .and_then(|metadata| metadata.modified())
        .map(|modified| {
            modified
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64
        })
        .unwrap_or_default();

    let mut buffer = Vec::new();
    for name in archive_listing::list_child_dirs(archive, inner_dir)? {
        push_entry(&mut buffer, true, &name, last_modified_timestamp_ms);
    }
    Ok(Response::new(buffer))
}

/// Appends one entry record to the binary listing buffer.
///
/// See [`get_entries_in_dir`] for the record layout.
fn push_entry(buffer: &mut Vec<u8>, is_directory: bool, name: &str, last_modified_ms: u64) {
    // is_directory (1 byte)
    buffer.push(if is_directory { 1 } else { 0 });

    // name (len: 4 bytes + content)
    let name_bytes = name.as_bytes();
    buffer.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
    buffer.extend_from_slice(name_bytes);

    // last_modified (8 bytes)
    buffer.extend_from_slice(&last_modified_ms.to_be_bytes());
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

    #[cfg(unix)]
    #[tokio::test]
    async fn test_get_entries_in_dir_skips_broken_symlink() {
        // A dangling symlink makes metadata()/modified() fail. It must be skipped
        // rather than aborting the whole listing.
        let temp_dir = TempDir::new().unwrap();
        fs::File::create(temp_dir.path().join("archive.zip")).unwrap();
        std::os::unix::fs::symlink(
            temp_dir.path().join("does-not-exist"),
            temp_dir.path().join("broken"),
        )
        .unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);

        // The valid archive is still listed despite the broken symlink.
        assert!(entries
            .iter()
            .any(|e| e.name == "archive.zip" && !e.is_directory));
    }

    /// Builds a ZIP with the given entry names and one dummy byte each.
    fn create_test_zip(dir: &std::path::Path, names: &[&str]) -> std::path::PathBuf {
        use std::io::Write;
        use zip::write::{FileOptions, ZipWriter};

        let zip_path = dir.join("nested.zip");
        let mut zip = ZipWriter::new(fs::File::create(&zip_path).expect("create zip"));
        for name in names {
            zip.start_file(*name, FileOptions::<()>::default())
                .expect("start entry");
            zip.write_all(&[0u8]).expect("write entry");
        }
        zip.finish().expect("finish zip");
        zip_path
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_lists_the_folders_at_an_archive_root() {
        let temp_dir = TempDir::new().unwrap();
        let zip_path = create_test_zip(
            temp_dir.path(),
            &[
                "cover.png",
                "ch1/001.png",
                "ch2/001.png",
                "ch1/deeper/002.png",
            ],
        );

        let result = get_entries_in_dir(zip_path.to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));

        // Folders only: pages are not books, and `deeper` belongs to the level below.
        assert_eq!(
            vec!["ch1".to_string(), "ch2".to_string()],
            entries.iter().map(|e| e.name.clone()).collect::<Vec<_>>()
        );
        assert!(entries.iter().all(|e| e.is_directory));
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_lists_the_folders_inside_an_archive_folder() {
        let temp_dir = TempDir::new().unwrap();
        let zip_path = create_test_zip(temp_dir.path(), &["ch1/001.png", "ch1/deeper/002.png"]);

        let inner = zip_path.join("ch1");
        let result = get_entries_in_dir(inner.to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));

        assert_eq!(1, entries.len());
        assert!(entries[0].is_directory);
        assert_eq!("deeper", entries[0].name);
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_reads_a_real_folder_named_like_an_archive() {
        // A folder literally called `comic.zip` must still be listed from the filesystem.
        let temp_dir = TempDir::new().unwrap();
        let folder = temp_dir.path().join("comic.zip");
        fs::create_dir(&folder).unwrap();
        fs::create_dir(folder.join("ch1")).unwrap();
        fs::File::create(folder.join("inner.zip")).unwrap();

        let result = get_entries_in_dir(folder.to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));

        assert_eq!(2, entries.len());
        assert!(entries.iter().any(|e| e.is_directory && e.name == "ch1"));
        assert!(entries
            .iter()
            .any(|e| !e.is_directory && e.name == "inner.zip"));
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
