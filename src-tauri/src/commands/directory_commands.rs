use std::fs::read_dir;
use std::path::Path;
use tauri::ipc::Response;

use crate::blocking::run_blocking;
use crate::container::{archive_listing, archive_path, traits::Container};
use crate::error::Result;
use crate::perf;
use crate::perf::Span;

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
/// This function will return an `Err` if `dir_path` does not exist or cannot be read,
/// or if it names an archive (or a folder inside one) whose listing cannot be read. A
/// folder entry that cannot be read, whose name is not valid UTF-8, or whose metadata
/// cannot be read is skipped with a warning in the log instead.
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
    let span = Span::start();
    let dir_path = dir_path.to_string();
    // On a blocking thread: a folder on a NAS or a spun-down disk must not stall every
    // other IPC call while it is read.
    let listing = run_blocking(move || list_entries(&dir_path)).await?;
    perf!(
        span,
        "list_dir",
        "entries={} scanned={}",
        listing.entries,
        listing.scanned
    );
    Ok(Response::new(listing.buffer))
}

/// Encoded directory listing along with counts for performance logging.
struct DirListing {
    buffer: Vec<u8>,
    entries: usize,
    scanned: usize,
}

/// Lists the sub-folders and supported books directly inside `dir_path`, encoded as
/// [`push_entry`] writes them.
///
/// # Arguments
///
/// * `dir_path` - A directory, an archive file, or a folder inside an archive.
///
/// # Returns
///
/// A [`DirListing`] holding the encoded entries and scan counts.
///
/// # Errors
///
/// Returns an `Err` if the directory or archive cannot be read.
fn list_entries(dir_path: &str) -> Result<DirListing> {
    // Open the directory directly first: on a real folder (including one literally named
    // `comic.zip`), this avoids extra `stat` round-trips over a NAS. Only fall back to
    // archive resolution when `read_dir` fails.
    let dir_iter = match read_dir(dir_path) {
        Ok(iter) => iter,
        Err(read_err) => {
            let path = Path::new(dir_path);
            if archive_path::is_navigable_archive(path) && path.is_file() {
                return list_archive_dirs(path, "");
            }
            if let Some(location) = archive_path::resolve(dir_path) {
                return list_archive_dirs(&location.archive, &location.inner_dir);
            }
            return Err(read_err.into());
        }
    };

    let mut buffer = Vec::new();
    let mut entries = 0usize;
    let mut scanned = 0usize;
    for entry in dir_iter {
        scanned += 1;
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
        // On Windows, `DirEntry::file_type` and `DirEntry::metadata` both read the
        // `WIN32_FIND_DATAW` already fetched by `read_dir` (zero extra syscalls / SMB
        // round-trips per entry). On Unix, `file_type` reads `d_type` to skip unsupported
        // files before `metadata` (`lstat` for `mtime`); filesystems returning `DT_UNKNOWN`
        // fall back to `lstat` inside `file_type`. Only symbolic links (including Windows
        // NTFS directory junctions) follow the link via `fs::metadata`.
        let entry_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(e) => {
                log::warn!("skipping entry '{file_name}': failed to read file type: {e}");
                continue;
            }
        };

        let (is_dir, metadata) = if entry_type.is_symlink() {
            let metadata = match std::fs::metadata(entry.path()) {
                Ok(metadata) => metadata,
                Err(e) => {
                    log::warn!("skipping entry '{file_name}': failed to read metadata: {e}");
                    continue;
                }
            };
            let target_type = metadata.file_type();
            if target_type.is_dir() {
                (true, metadata)
            } else if target_type.is_file() && <dyn Container>::is_supported_format(&file_name) {
                (false, metadata)
            } else {
                continue;
            }
        } else {
            let is_dir = if entry_type.is_dir() {
                true
            } else if entry_type.is_file() && <dyn Container>::is_supported_format(&file_name) {
                false
            } else {
                continue;
            };
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(e) => {
                    log::warn!("skipping entry '{file_name}': failed to read metadata: {e}");
                    continue;
                }
            };
            (is_dir, metadata)
        };

        let last_modified = match metadata.modified() {
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

        push_entry(&mut buffer, is_dir, &file_name, last_modified_timestamp_ms);
        entries += 1;
    }
    Ok(DirListing {
        buffer,
        entries,
        scanned,
    })
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
/// A [`DirListing`] holding the encoded folder rows and counts.
///
/// # Errors
///
/// Returns an `Err` if the archive cannot be read.
fn list_archive_dirs(archive: &Path, inner_dir: &str) -> Result<DirListing> {
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
    let dirs = archive_listing::list_child_dirs(archive, inner_dir)?;
    let count = dirs.len();
    for name in &dirs {
        push_entry(&mut buffer, true, name, last_modified_timestamp_ms);
    }
    // Archive entry scanning is encapsulated inside `archive_listing`, so `scanned`
    // mirrors the listed folder count here.
    Ok(DirListing {
        buffer,
        entries: count,
        scanned: count,
    })
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
    async fn test_get_entries_in_dir_skips_a_non_unicode_name() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let temp_dir = TempDir::new().unwrap();
        fs::File::create(temp_dir.path().join("valid.zip")).unwrap();
        // A name with an invalid UTF-8 byte: into_string() rejects it.
        let bad = OsStr::from_bytes(b"bad\xFF.zip");
        fs::File::create(temp_dir.path().join(bad)).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));
        assert_eq!(
            vec!["valid.zip".to_string()],
            entries.iter().map(|e| e.name.clone()).collect::<Vec<_>>()
        );
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn test_get_entries_in_dir_skips_a_non_unicode_name() {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        let temp_dir = TempDir::new().unwrap();
        fs::File::create(temp_dir.path().join("valid.zip")).unwrap();
        // "test<unpaired-surrogate>.zip": 0xD800 is an unpaired surrogate, so
        // into_string() rejects the name.
        let bad: OsString = OsString::from_wide(&[
            0x0074, 0x0065, 0x0073, 0x0074, 0xD800, 0x002E, 0x007A, 0x0069, 0x0070,
        ]);
        if fs::File::create(temp_dir.path().join(&bad)).is_err() {
            // Some filesystems reject unpaired surrogates outright; nothing to assert.
            return;
        }

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));
        assert_eq!(
            vec!["valid.zip".to_string()],
            entries.iter().map(|e| e.name.clone()).collect::<Vec<_>>()
        );
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

    #[cfg(unix)]
    #[tokio::test]
    async fn symlinks_are_listed_as_what_they_point_at() {
        let temp_dir = TempDir::new().unwrap();
        let target_dir = temp_dir.path().join("real-folder");
        fs::create_dir(&target_dir).unwrap();
        let target_zip = temp_dir.path().join("real.zip");
        fs::File::create(&target_zip).unwrap();
        std::os::unix::fs::symlink(&target_dir, temp_dir.path().join("linked-folder")).unwrap();
        std::os::unix::fs::symlink(&target_zip, temp_dir.path().join("linked.zip")).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let bytes = get_bytes_from_response(result);
        let entries = parse_entries(&bytes);

        assert!(entries
            .iter()
            .any(|e| e.name == "linked-folder" && e.is_directory));
        assert!(entries
            .iter()
            .any(|e| e.name == "linked.zip" && !e.is_directory));
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
        assert_eq!(entries.len(), 1);

        let expected = fs::metadata(&file_path)
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        for entry in entries {
            assert_eq!(
                entry.last_modified, expected,
                "last_modified should be milliseconds since the UNIX epoch"
            );
        }
    }

    #[test]
    fn push_entry_matches_the_shared_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../src/test/fixtures/binaryPayloads.json"
        )))
        .unwrap();
        let dir_entries = &fixture["dirEntries"];
        let expected: Vec<u8> = serde_json::from_value(dir_entries["bytes"].clone()).unwrap();

        let mut buffer = Vec::new();
        for entry in dir_entries["entries"].as_array().unwrap() {
            push_entry(
                &mut buffer,
                entry["isDirectory"].as_bool().unwrap(),
                entry["name"].as_str().unwrap(),
                entry["lastModified"].as_u64().unwrap(),
            );
        }

        assert_eq!(buffer, expected);
    }

    // Sync test driving a current-thread runtime so `perf::capture::Recording` (which holds
    // a `std::sync::MutexGuard`) is never held across an `.await` point.
    #[test]
    fn test_get_entries_in_dir_records_perf_span() {
        let temp_dir = TempDir::new().unwrap();
        fs::create_dir(temp_dir.path().join("subdir")).unwrap();
        fs::File::create(temp_dir.path().join("book.zip")).unwrap();
        fs::File::create(temp_dir.path().join("ignored.txt")).unwrap();

        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let recording = crate::perf::capture::record();
        let result = runtime
            .block_on(get_entries_in_dir(
                temp_dir.path().to_string_lossy().as_ref(),
            ))
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));
        assert_eq!(entries.len(), 2);

        let lines = recording.lines("list_dir");
        assert_eq!(lines.len(), 1);
        assert!(
            lines[0].contains("entries=2 scanned=3"),
            "unexpected perf record: {}",
            lines[0]
        );
    }

    #[tokio::test]
    async fn test_get_entries_in_dir_rejects_non_archive_file() {
        let temp_dir = TempDir::new().unwrap();
        let pdf = temp_dir.path().join("book.pdf");
        fs::File::create(&pdf).unwrap();

        let result = get_entries_in_dir(pdf.to_string_lossy().as_ref()).await;
        assert!(result.is_err());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn symlinks_to_unsupported_files_are_skipped() {
        let temp_dir = TempDir::new().unwrap();
        let target = temp_dir.path().join("notes.txt");
        fs::File::create(&target).unwrap();
        std::os::unix::fs::symlink(&target, temp_dir.path().join("link.txt")).unwrap();

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));
        assert!(entries.is_empty());
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn windows_junctions_are_listed_and_broken_junctions_are_skipped() {
        use std::process::Command;

        let temp_dir = TempDir::new().unwrap();
        let target_dir = temp_dir.path().join("real-folder");
        let gone_dir = temp_dir.path().join("gone-folder");
        fs::create_dir(&target_dir).unwrap();
        fs::create_dir(&gone_dir).unwrap();

        let valid_junction = temp_dir.path().join("linked-folder");
        let broken_junction = temp_dir.path().join("broken-folder");
        let make_junction = |link: &std::path::Path, target: &std::path::Path| {
            let output = Command::new("cmd")
                .args([
                    "/C",
                    "mklink",
                    "/J",
                    &link.to_string_lossy(),
                    &target.to_string_lossy(),
                ])
                .output()
                .expect("invoke mklink");
            assert!(
                output.status.success(),
                "mklink /J failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        };
        make_junction(&valid_junction, &target_dir);
        make_junction(&broken_junction, &gone_dir);
        fs::remove_dir(&gone_dir).unwrap();

        let expected_modified = fs::metadata(&target_dir)
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        let result = get_entries_in_dir(temp_dir.path().to_string_lossy().as_ref())
            .await
            .unwrap();
        let entries = parse_entries(&get_bytes_from_response(result));

        let linked = entries
            .iter()
            .find(|e| e.name == "linked-folder")
            .expect("valid junction should be listed");
        assert!(linked.is_directory);
        assert_eq!(linked.last_modified, expected_modified);
        assert!(!entries.iter().any(|e| e.name == "broken-folder"));
    }
}
