use tokio::sync::{Mutex, RwLock};

use serde::{Deserialize, Serialize};
use tauri::ipc::Response;

use crate::{
    error::{Error, Result},
    image::types::ImageDimensions,
    page::service::Priority,
    perf,
    perf::Span,
    state::{app_state::AppState, container_state::ContainerState},
};

/// Serializes container opens so the most recently started one is left installed.
///
/// The heavy build still runs without holding the state write lock (so image fetches
/// aren't blocked); this only orders the opens themselves, preventing a slower earlier
/// open from installing after a newer one.
static OPEN_CONTAINER_LOCK: Mutex<()> = Mutex::const_new(());

/// The error every command raises when the book it names is not the book that is open.
///
/// Entry names collide across archives — every book has an `0001.jpg` — so resolving one
/// against the wrong book would silently serve another book's page. Raised in one place
/// rather than repeated at each command, because `service_for` is the only way in.
fn stale(path: &str, what: &str) -> Error {
    Error::EntryNotFound(format!(
        "Container changed while requesting {what} (requested {path})"
    ))
}

/// The result of getting entries in a container.
#[derive(Serialize, Deserialize, specta::Type)]
pub struct EntriesResult {
    /// The entry names in the container.
    entries: Vec<String>,
    /// Whether the container is a directory.
    is_directory: bool,
    /// Whether the container is an EPUB novel.
    is_novel: bool,
}

/// Opens a container file (e.g., ZIP, RAR) and retrieves a list of its contents.
///
/// This function opens the container specified by the `path` and reads the list of file entries
/// within it.
///
/// # Arguments
///
/// * `path` - The file path to the container to open.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` with an `EntriesResult` struct containing the list of entry
/// names, a boolean indicating if the path is a directory, and a boolean indicating if it's a novel.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The container file cannot be opened (e.g., it does not exist or is corrupt).
/// * The `container` within the application state is unexpectedly missing.
#[tauri::command()]
#[specta::specta]
pub async fn get_entries_in_container(
    path: &str,
    state: tauri::State<'_, RwLock<AppState>>,
) -> Result<EntriesResult> {
    log::debug!("Get the entries in {}", path);

    // Serialize opens so a slower earlier open can't install after a newer one and
    // leave the wrong book's images loaded.
    let span = Span::start();
    let _open_guard = OPEN_CONTAINER_LOCK.lock().await;

    // Snapshot the (cheap-to-clone) settings and cache handle under a brief read lock,
    // then run the heavy build on a blocking thread so it never stalls the async runtime
    // (image fetches, IPC) while opening a large book on slow storage.
    let (settings, image_cache) = {
        let state_lock = state.read().await;
        (
            state_lock.container_state.settings.clone(),
            state_lock.container_state.image_cache.clone(),
        )
    };
    let path_owned = path.to_string();
    let built = tauri::async_runtime::spawn_blocking(move || {
        ContainerState::build_with(&settings, &image_cache, &path_owned)
    })
    .await
    .map_err(|e| Error::Other(format!("Spawn blocking failed: {e}")))
    .and_then(|result| result);
    let service = match built {
        Ok(service) => service,
        Err(e) => {
            // Clear stale state so a failed open doesn't keep serving the previous book.
            state.write().await.container_state.clear();
            return Err(e);
        }
    };

    let container = service.container();
    let workers = service.workers();
    let entries = container.get_entries().clone();
    let is_directory = container.is_directory();
    let is_novel = container.is_novel();

    // A container with no readable pages is not a book. Failing here keeps it out of the
    // library and the history, since the frontend only records a book after this returns.
    // EPUB novels are exempt: their text has no image entries.
    if !is_novel && entries.is_empty() {
        log::info!("Refusing to open {path}: no readable pages");
        state.write().await.container_state.clear();
        return Err(Error::EmptyContainer(path.to_string()));
    }

    {
        let mut state_lock = state.write().await;
        state_lock.container_state.install(service);
    }

    if !is_novel {
        let state_lock = state.read().await;
        if let Some(service) = state_lock.container_state.service_for(path) {
            log::debug!("Triggering proactive preloading for {}", path);
            if let Err(e) = service.request_preload_around(0, 5) {
                // Proactive preloading is best-effort; a failure here must not fail the open.
                log::warn!("Failed to trigger proactive preloading for {path}: {e}");
            }
        }
    }

    // The whole open: the container build, and the reader pool it started.
    let pages = entries.len();
    let format = std::path::Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("dir");
    perf!(
        span,
        "open",
        "format={format} pages={pages} workers={workers} novel={is_novel}"
    );

    Ok(EntriesResult {
        entries,
        is_directory,
        is_novel,
    })
}

/// Requests preloading of images around a specific index.
///
/// This command can be called as the user navigates through a book to update
/// which images are prioritized for background loading.
///
/// # Arguments
///
/// * `path` - The path of the container the caller believes is open.
/// * `index` - The current page index around which to preload.
/// * `buffer_size` - Optional. How many pages to preload in each direction.
///   Defaults to 10 if `None` is provided.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Errors
///
/// Returns an `Err` if no container is open, or `path` does not match the open one — the
/// frontend calls this on every page turn, so it is exactly the request most likely to
/// race a book switch.
#[tauri::command()]
#[specta::specta]
pub async fn request_preload_around(
    path: &str,
    index: usize,
    buffer_size: Option<usize>,
    state: tauri::State<'_, RwLock<AppState>>,
) -> Result<()> {
    log::debug!(
        "Request preload around index {}, buffer_size: {:?}",
        index,
        buffer_size
    );
    let state_lock = state.read().await;

    let buffer_size = buffer_size.unwrap_or(10);

    let service = state_lock
        .container_state
        .service_for(path)
        .ok_or_else(|| stale(path, "preloading"))?;

    service.request_preload_around(index, buffer_size)?;
    Ok(())
}

/// Retrieves the pixel dimensions of every entry in the currently open container.
///
/// The viewer needs the orientation of every page to decide where two-page spreads
/// start, including pages it has not displayed yet. Dimensions are read from image
/// headers (or PDF page sizes), so no pixel data is decoded.
///
/// # Arguments
///
/// * `path` - The path of the container the caller believes is open.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` with one `ImageDimensions` per entry, in the same order as
/// `get_entries_in_container` returned them.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * No container is currently open.
/// * `path` does not match the open container (the book was switched meanwhile).
/// * An entry cannot be read or is not a supported image.
#[tauri::command()]
#[specta::specta]
pub async fn get_image_dimensions(
    path: &str,
    state: tauri::State<'_, RwLock<AppState>>,
) -> Result<Vec<ImageDimensions>> {
    log::debug!("Get the dimensions of every entry in {}", path);

    // Clone the handle out under a brief read lock, then release it so the scan below
    // runs without blocking other state access.
    let service = {
        let state_lock = state.read().await;
        state_lock.container_state.service_for(path)
    }
    .ok_or_else(|| stale(path, "dimensions"))?;

    // One `Scan` job per page rather than one pass over the archive, so a page turn
    // during the scan is served at the next job instead of after all of them.
    tauri::async_runtime::spawn_blocking(move || service.dimensions())
        .await
        .map_err(|e| Error::Other(format!("Spawn blocking failed: {e}")))?
}

/// Retrieves an image from the currently open container.
///
/// This function fetches the binary data for a specified image entry from the container
/// that is currently loaded in the application state.
///
/// # Arguments
///
/// * `path` - The path of the container, used primarily for logging purposes.
/// * `entry_name` - The name of the image entry to retrieve (e.g., "image1.png").
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `tauri::ipc::Response`. The response body contains the
/// image data in a custom binary format: `[Width (4 bytes)][Height (4 bytes)][Image Data...]`.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `image_loader` within the application state is unexpectedly missing.
/// * The requested image entry cannot be found or decoded.
#[tauri::command]
pub async fn get_image(
    path: &str,
    entry_name: &str,
    state: tauri::State<'_, RwLock<AppState>>,
) -> Result<Response> {
    log::debug!("Get the binary of {} in {}", entry_name, path);

    // Clone the loader handle out under a brief read lock, then release the lock so the
    // decode below runs without blocking other state access.
    let service = {
        let state_lock = state.read().await;
        state_lock.container_state.service_for(path)
    }
    .ok_or_else(|| stale(path, entry_name))?;

    let entry = entry_name.to_string();
    // Foreground: this page is what the reader is waiting to see, so it outranks every
    // queued preload and scan job and waits only on the page each worker is already on.
    let image =
        tauri::async_runtime::spawn_blocking(move || service.page(&entry, Priority::Foreground))
            .await
            .map_err(|e| Error::Other(format!("Spawn blocking failed: {e}")))??;

    Ok(image.to_ipc_response())
}

/// Retrieves a preview version of an image from the container.
///
/// This function fetches a smaller, preview version of an image entry. If a preview is
/// successfully generated, it is returned in the same binary format as `get_image`.
/// If the preview is skipped (e.g., it's already cached), an empty response is returned.
///
/// # Arguments
///
/// * `path` - The path of the container, used primarily for logging purposes.
/// * `entry_name` - The name of the image entry for which to generate a preview.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `tauri::ipc::Response`. The response body may contain
/// image data or be empty if the preview generation was skipped.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `image_loader` within the application state is unexpectedly missing.
/// * The preview image cannot be retrieved or generated.
#[tauri::command]
pub async fn get_image_preview(
    path: &str,
    entry_name: &str,
    state: tauri::State<'_, RwLock<AppState>>,
) -> Result<Response> {
    log::debug!("Get the preview binary of {} in {}", entry_name, path);

    let service = {
        let state_lock = state.read().await;
        state_lock.container_state.service_for(path)
    }
    .ok_or_else(|| stale(path, entry_name))?;

    let entry = entry_name.to_string();
    let preview = tauri::async_runtime::spawn_blocking(move || service.preview(&entry))
        .await
        .map_err(|e| Error::Other(format!("Spawn blocking failed: {e}")))??;

    let Some(image) = preview else {
        // Return an empty response if preview skipped.
        return Ok(Response::new(Vec::new()));
    };

    Ok(image.to_ipc_response())
}

#[cfg(test)]
mod tests {
    use mockall::predicate::eq;

    use super::*;
    use std::{path, sync::Arc};
    use tauri::{ipc::InvokeResponseBody::Raw, ipc::IpcResponse, Manager};
    use tokio::sync::RwLock;

    use crate::{
        container::traits::{MockContainer, MockPageReader, PageReader},
        image::{resizer::ResizeFilter, types::Image},
        page::{pipeline::Pipeline, service::PageService},
        state::container_state::ContainerState,
    };

    /// A real 800x600 PNG.
    ///
    /// Pages travel from a reader as encoded bytes and are decoded by the pipeline, so a
    /// page fixture has to be an actual image rather than a buffer of zeros.
    fn dummy_page() -> Vec<u8> {
        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(800, 600))
            .write_to(
                &mut std::io::Cursor::new(&mut buffer),
                image::ImageFormat::Png,
            )
            .expect("failed to encode the page fixture");
        buffer
    }

    impl MockContainer {
        /// The image every mock reader in this module serves.
        fn create_dummy_image() -> Arc<Image> {
            Arc::new(Image::new(dummy_page()).expect("the page fixture must be a real image"))
        }
    }

    /// A container listing `entries`, whose readers serve [`dummy_page`] for each of them.
    ///
    /// A mock is not `Clone`, so `open_reader` builds a fresh `MockPageReader` inside its
    /// closure — which is also what lets one worker be handed a reader of its own.
    fn page_container(entries: &[&str]) -> MockContainer {
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(
            entries
                .iter()
                .map(|entry| (*entry).to_string())
                .collect::<Vec<String>>(),
        );
        // `automock` covers defaulted methods too, so a mock that never stubs this panics
        // the moment `PageService::new` sizes its pool.
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(|_| Ok(dummy_page()));
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        container
    }

    /// Installs `container` as the open book under `book_id`.
    fn manage_service(
        app: &tauri::App<tauri::test::MockRuntime>,
        book_id: &str,
        container: MockContainer,
    ) {
        let mut container_state = ContainerState::default();
        container_state.install(PageService::new(
            book_id.to_string(),
            Arc::new(container),
            Pipeline {
                max_image_height: 2000,
                resize_method: ResizeFilter::Bilinear,
            },
            mini_moka::sync::Cache::new(100),
        ));
        app.manage(RwLock::new(AppState { container_state }));
    }

    /// A valid 1x1 PNG. Previews travel as encoded bytes and are decoded by the loader,
    /// so a preview fixture has to be a real image where `create_dummy_image` need not be.
    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    // Since programmatically generating a RAR file is complicated,
    // a dummy RAR file was created manually beforehand.
    //
    // This function copies that pre-existing RAR file to the path specified in the arguments.
    fn create_dummy_rar(dir: &path::Path, filename: &str) -> path::PathBuf {
        let dummy_rar_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("resources")
            .join("test.rar");
        if !dummy_rar_path.exists() {
            panic!(
                "Dummy RAR file not found at {}. Please create it manually as per instructions.",
                dummy_rar_path.display()
            );
        }

        let rar_filepath = dir.join(filename);
        std::fs::copy(dummy_rar_path, &rar_filepath).unwrap();
        rar_filepath
    }

    #[tokio::test]
    async fn test_get_entries_in_container_rejects_a_container_without_pages() {
        use std::io::Write;
        use zip::write::{FileOptions, ZipWriter};

        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = dir.path().join("multi.zip");
        let mut zip = ZipWriter::new(std::fs::File::create(&zip_path).expect("create zip"));
        // Two sub-folders, so auto-descend has nothing to pick and the root stays empty.
        for name in ["ch1/001.png", "ch2/001.png"] {
            zip.start_file(name, FileOptions::<()>::default())
                .expect("start entry");
            zip.write_all(&[0u8]).expect("write entry");
        }
        zip.finish().expect("finish zip");

        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result =
            get_entries_in_container(zip_path.to_string_lossy().as_ref(), app.state()).await;

        let Err(err) = result else {
            panic!("expected an empty-container error");
        };
        assert!(err.to_string().contains("Empty Container Error"));
    }

    #[tokio::test]
    async fn test_get_entries_in_container() {
        let dir = tempfile::tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let expected_entries = [
            "image1.png".to_string(),
            "image2.png".to_string(),
            "image3.png".to_string(),
        ];

        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result =
            get_entries_in_container(rar_path.to_string_lossy().as_ref(), app.state()).await;

        assert!(result.is_ok());

        let actual_entries_result = result.unwrap();
        assert_eq!(expected_entries.len(), actual_entries_result.entries.len());
        assert_eq!(expected_entries[0], actual_entries_result.entries[0]);
        assert_eq!(expected_entries[1], actual_entries_result.entries[1]);
        assert_eq!(expected_entries[2], actual_entries_result.entries[2]);
        assert!(!actual_entries_result.is_directory);
    }

    #[tokio::test]
    async fn test_get_entries_in_container_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result = get_entries_in_container("non_existent_path", app.state()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_entries_in_container_clears_state_on_failure() {
        let dir = tempfile::tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");

        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        // Open a valid container first; state now holds the book's service.
        get_entries_in_container(rar_path.to_string_lossy().as_ref(), app.state())
            .await
            .expect("opening a valid container should succeed");
        {
            let binding = app.state::<RwLock<AppState>>();
            let guard = binding.read().await;
            assert!(guard.container_state.is_open());
        }

        // A subsequent failed open must clear the previous service so we never serve
        // images from the old book.
        let result = get_entries_in_container("non_existent_path", app.state()).await;
        assert!(result.is_err());
        {
            let binding = app.state::<RwLock<AppState>>();
            let guard = binding.read().await;
            assert!(!guard.container_state.is_open());
        }
    }

    #[tokio::test]
    async fn test_get_entries_in_container_succeeds_with_best_effort_preload() {
        // A non-novel open triggers proactive preloading, which is best-effort: the open
        // must still succeed and return its entries, and the loader must be installed
        // regardless of the preload outcome.
        let dir = tempfile::tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");

        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result =
            get_entries_in_container(rar_path.to_string_lossy().as_ref(), app.state()).await;

        let entries_result = result.expect("a valid non-novel open should succeed");
        assert!(!entries_result.is_novel);
        assert_eq!(3, entries_result.entries.len());

        let binding = app.state::<RwLock<AppState>>();
        let guard = binding.read().await;
        assert!(guard.container_state.is_open());
    }

    #[tokio::test]
    async fn test_get_image_in_container() {
        let app = tauri::test::mock_app();
        manage_service(
            &app,
            "dummy_book_id",
            page_container(&["test1.png", "test2.png"]),
        );

        // The path must match the service's book_id ("dummy_book_id"): `service_for`
        // rejects a request whose path disagrees with the open book.
        let result = get_image("dummy_book_id", "test1.png", app.state()).await;

        assert!(result.is_ok());

        let expected_image = MockContainer::create_dummy_image();
        let response = result.unwrap();

        // Deserialize the response binary data.
        // Format: [Width (4 bytes)][Height (4 bytes)][Image Data...]
        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => {
                panic!("Unexpected response body type");
            }
        };

        let actual_width = u32::from_be_bytes([body[0], body[1], body[2], body[3]]);
        let actual_height = u32::from_be_bytes([body[4], body[5], body[6], body[7]]);
        let actual_data = &body[8..];

        assert_eq!(expected_image.width, actual_width);
        assert_eq!(expected_image.height, actual_height);
        assert_eq!(expected_image.data.as_slice(), actual_data);
    }

    #[tokio::test]
    async fn test_get_image_rejects_stale_container_path() {
        // A request whose path does not match the installed loader's book_id raced a
        // book switch; it must be rejected (EntryNotFound), not served another book's page.
        let app = tauri::test::mock_app();
        manage_service(&app, "current_book_id", page_container(&["test1.png"]));

        // Ask for a page in a *different* book than the one installed.
        let result = get_image("stale_book_id", "test1.png", app.state()).await;

        let Err(err) = result else {
            panic!("a stale-path get_image should be rejected");
        };
        assert!(
            matches!(err, Error::EntryNotFound(_)),
            "unexpected error: {err}"
        );
    }

    /// Builds an app state around a two-page book whose pages differ in orientation.
    fn manage_mock_state(app: &tauri::App<tauri::test::MockRuntime>, book_id: &str) {
        let mut container = MockContainer::new();
        container
            .expect_get_entries()
            .return_const(vec!["test1.png".to_string(), "test2.png".to_string()]);
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_page_dimensions().returning(|entry| {
                Ok(if entry == "test1.png" {
                    ImageDimensions {
                        width: 800,
                        height: 600,
                    }
                } else {
                    ImageDimensions {
                        width: 600,
                        height: 800,
                    }
                })
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        manage_service(app, book_id, container);
    }

    #[tokio::test]
    async fn test_get_image_dimensions_returns_one_entry_per_page() {
        let app = tauri::test::mock_app();
        manage_mock_state(&app, "dummy_book_id");

        let result = get_image_dimensions("dummy_book_id", app.state()).await;

        assert_eq!(
            result.expect("get_image_dimensions should succeed"),
            vec![
                ImageDimensions {
                    width: 800,
                    height: 600
                },
                ImageDimensions {
                    width: 600,
                    height: 800
                },
            ]
        );
    }

    #[tokio::test]
    async fn test_get_image_dimensions_rejects_stale_container_path() {
        // Mirrors get_image: a request that raced a book switch must be rejected rather
        // than measured against another book's pages.
        let app = tauri::test::mock_app();
        manage_mock_state(&app, "current_book_id");

        let result = get_image_dimensions("stale_book_id", app.state()).await;

        let Err(err) = result else {
            panic!("a stale-path get_image_dimensions should be rejected");
        };
        assert!(
            matches!(err, Error::EntryNotFound(_)),
            "unexpected error: {err}"
        );
    }

    #[tokio::test]
    async fn test_get_image_dimensions_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result = get_image_dimensions("non_existent_path", app.state()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_image_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result = get_image("non_existent_path", "image.png", app.state()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_request_preload_around() {
        let app = tauri::test::mock_app();
        manage_service(&app, "dummy_book_id", page_container(&["test1.png"]));

        let result = request_preload_around("dummy_book_id", 0, Some(5), app.state()).await;
        assert!(result.is_ok());

        // Preloading is subject to the same check as every other request: the frontend
        // issues it on every page turn, so it is the one most likely to race a switch.
        let stale = request_preload_around("stale_book_id", 0, Some(5), app.state()).await;
        assert!(matches!(stale, Err(Error::EntryNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_image_preview() {
        let app = tauri::test::mock_app();
        let mut container = MockContainer::new();
        // A preview comes from a reader, and only from a container that has a cheaper
        // path to one; this mock stands in for PDF, the only such format.
        container
            .expect_get_entries()
            .return_const(vec!["test1.png".to_string()]);
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader
                .expect_read_preview()
                .with(eq("test1.png".to_string()))
                .returning(|_| Ok(Some(DUMMY_PNG_DATA.to_vec())));
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        manage_service(&app, "dummy_book_id", container);

        let result = get_image_preview("dummy_book_id", "test1.png", app.state()).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        // `to_ipc_response` frames the bytes behind a width/height header, so the reader's
        // own bytes are what follows it.
        assert!(body.ends_with(DUMMY_PNG_DATA));
    }

    #[tokio::test]
    async fn test_get_image_preview_is_empty_without_a_cheaper_path() {
        let app = tauri::test::mock_app();
        let mut container = MockContainer::new();
        // Every image container answers this way: reading the page and previewing it cost
        // the same read and decode, so there is nothing cheaper to send.
        container
            .expect_get_entries()
            .return_const(vec!["test1.png".to_string()]);
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_read_preview().returning(|_| Ok(None));
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        manage_service(&app, "dummy_book_id", container);

        let result = get_image_preview("dummy_book_id", "test1.png", app.state()).await;
        let body = match result.unwrap().body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        // An empty response is the wire form of "no preview"; the frontend stops asking.
        assert!(body.is_empty());
    }
}
