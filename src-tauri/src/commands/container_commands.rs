use tokio::sync::RwLock;

use tauri::ipc::Response;

use crate::{
    blocking::run_blocking,
    error::{Error, Result},
    image::types::{Image, ImageDimensions},
    page::{pipeline::Fit, service::Priority},
    state::container_state::ContainerState,
};

/// The error every command raises when the book it names is not the book that is open.
///
/// Entry names collide across archives — every book has an `0001.jpg` — so resolving one
/// against the wrong book would silently serve another book's page. Raised in one place
/// rather than repeated at each command, because `service_for` is the only way in.
fn stale(path: &str, what: &str) -> Error {
    Error::BookChanged(format!(
        "Container changed while requesting {what} (requested {path})"
    ))
}

/// Frames a page for the binary IPC response the reader decodes.
///
/// The layout is `[width (4 bytes, big-endian)][height (4 bytes, big-endian)][image bytes]`.
///
/// # Arguments
///
/// * `image` - The page to send.
///
/// # Returns
///
/// The framed response.
fn image_response(image: &Image) -> Response {
    let mut body = Vec::with_capacity(8 + image.data.len());
    body.extend_from_slice(&image.width.to_be_bytes());
    body.extend_from_slice(&image.height.to_be_bytes());
    body.extend_from_slice(&image.data);
    Response::new(body)
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
/// * `buffer_size` - How many pages to preload in each direction.
/// * `caller_pages` - How many pages from `index` the caller is fetching itself. Those
///   are left out of the window: preloading a page the viewer is already requesting at
///   foreground priority only lets a background job reach it first, and the foreground
///   request then waits on that job instead of being served.
/// * `state` - The managed container state.
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
    buffer_size: usize,
    caller_pages: usize,
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<()> {
    log::debug!("Request preload around index {index}, buffer_size: {buffer_size}");
    let state_lock = state.read().await;

    let service = state_lock
        .service_for(path)
        .ok_or_else(|| stale(path, "preloading"))?;

    service.request_preload_around(index, buffer_size, caller_pages)?;
    Ok(())
}

/// Reports the size of the reader's viewport, in device pixels.
///
/// Pages are rendered to fit it so the viewer can draw them without scaling: the
/// browser's own downscale is a 2x2 bilinear tap below a 2x reduction, which is what
/// puts moiré on a screentoned page.
///
/// Recorded whether or not a book is open, because the size belongs to the window: the
/// next book has to open at the size the reader is already reading at.
///
/// # Arguments
///
/// * `width` - The viewport width in device pixels. `0` means "not measured yet".
/// * `height` - The viewport height in device pixels.
/// * `state` - The managed container state.
///
/// # Returns
///
/// `Ok(())` once the size is recorded.
///
/// # Errors
///
/// Never returns an `Err`; the `Result` keeps the command's shape with its neighbours.
#[tauri::command()]
#[specta::specta]
pub async fn set_display_size(
    width: u32,
    height: u32,
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<()> {
    log::debug!("The reader draws a page at {}x{} device px", width, height);

    let size = (width > 0 && height > 0).then_some(Fit { width, height });
    let mut state_lock = state.write().await;
    state_lock.display_size = size;
    if let Some(service) = state_lock.current_service() {
        service.set_display_size(size);
    }
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
/// * `state` - The managed container state.
///
/// # Returns
///
/// A `Result` which is `Ok` with one `ImageDimensions` per entry, in the same order as
/// `open_book` returned them.
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
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<Vec<ImageDimensions>> {
    log::debug!("Get the dimensions of every entry in {}", path);

    // Clone the handle out under a brief read lock, then release it so the scan below
    // runs without blocking other state access.
    let service = {
        let state_lock = state.read().await;
        state_lock.service_for(path)
    }
    .ok_or_else(|| stale(path, "dimensions"))?;

    // One `Scan` job per page rather than one pass over the archive, so a page turn
    // during the scan is served at the next job instead of after all of them.
    run_blocking(move || service.dimensions()).await
}

/// Retrieves an image from the currently open container.
///
/// This function fetches the binary data for a specified image entry from the book that
/// is open.
///
/// # Arguments
///
/// * `path` - The path of the container the caller believes is open.
/// * `entry_name` - The name of the image entry to retrieve (e.g., "image1.png").
/// * `generation` - The reader's display generation; a newer one cancels this request if
///   it is still queued.
/// * `state` - The managed container state.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `tauri::ipc::Response`. The response body contains the
/// image data in a custom binary format: `[Width (4 bytes)][Height (4 bytes)][Image Data...]`.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The book it names is not the book that is open.
/// * A newer display generation superseded the request (`RequestCancelled`).
/// * The requested image entry cannot be found or decoded.
#[tauri::command]
pub async fn get_image(
    path: &str,
    entry_name: &str,
    generation: u64,
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<Response> {
    log::debug!("Get the binary of {} in {}", entry_name, path);

    // Clone the loader handle out under a brief read lock, then release the lock so the
    // decode below runs without blocking other state access.
    let service = {
        let state_lock = state.read().await;
        state_lock.service_for(path)
    }
    .ok_or_else(|| stale(path, entry_name))?;

    // Foreground: this page is what the reader is waiting to see, so it outranks every
    // queued preload and scan job and waits only on the page each worker is already on.
    let image = service
        .page(entry_name, Priority::Foreground, Some(generation))
        .await?;

    Ok(image_response(&image))
}

/// Retrieves an image from the currently open container at its full size.
///
/// What the loupe shows. A page fitted to the viewport is exactly the wrong one there:
/// the loupe draws it magnified, so what it would show is an upscale of what is already
/// on screen.
///
/// # Arguments
///
/// * `path` - The path of the container the caller believes is open.
/// * `entry_name` - The name of the image entry to retrieve (e.g., "image1.png").
/// * `state` - The managed container state.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `tauri::ipc::Response`, in the same binary format
/// [`get_image`] answers with: `[Width (4 bytes)][Height (4 bytes)][Image Data...]`.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The book it names is not the book that is open.
/// * The requested image entry cannot be found or decoded.
#[tauri::command]
pub async fn get_image_full(
    path: &str,
    entry_name: &str,
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<Response> {
    log::debug!("Get the full-size binary of {} in {}", entry_name, path);

    let service = {
        let state_lock = state.read().await;
        state_lock.service_for(path)
    }
    .ok_or_else(|| stale(path, entry_name))?;

    let image = service.page_full(entry_name).await?;

    Ok(image_response(&image))
}

/// Retrieves a preview version of an image from the container.
///
/// This function fetches a smaller, preview version of an image entry. If a preview is
/// successfully generated, it is returned in the same binary format as `get_image`.
/// An empty response means no preview is needed or possible right now.
///
/// # Arguments
///
/// * `path` - The path of the container the caller believes is open.
/// * `entry_name` - The name of the image entry for which to generate a preview.
/// * `generation` - The reader's display generation; a newer one cancels this request if
///   it is still queued.
/// * `state` - The managed container state.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `tauri::ipc::Response`. The response body may contain
/// image data or be empty when no preview is needed or possible right now.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The book it names is not the book that is open.
/// * A newer display generation superseded the request (`RequestCancelled`).
/// * The preview image cannot be retrieved or generated.
#[tauri::command]
pub async fn get_image_preview(
    path: &str,
    entry_name: &str,
    generation: u64,
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<Response> {
    log::debug!("Get the preview binary of {} in {}", entry_name, path);

    let service = {
        let state_lock = state.read().await;
        state_lock.service_for(path)
    }
    .ok_or_else(|| stale(path, entry_name))?;

    let preview = service.preview(entry_name, Some(generation)).await?;

    let Some(image) = preview else {
        // Nothing to send now (the page is cached, or the book has no previews).
        return Ok(Response::new(Vec::new()));
    };

    Ok(image_response(&image))
}

/// Reads the EPUB file of the novel that is open, for the novel reader to render.
///
/// Serves only the open novel, so the webview needs no file system read permission and
/// a page cannot use this to read anything else.
///
/// # Arguments
///
/// * `path` - The path of the novel the caller believes is open.
/// * `state` - The managed container state.
///
/// # Returns
///
/// A `tauri::ipc::Response` whose body is the file's bytes, unframed.
///
/// # Errors
///
/// * [`Error::BookChanged`] if `path` is not the open book or the open book is not a novel.
/// * [`Error::PathNotFound`] if the file no longer exists.
/// * [`Error::Io`] if it cannot be read.
#[tauri::command()]
pub async fn read_novel_file(
    path: &str,
    state: tauri::State<'_, RwLock<ContainerState>>,
) -> Result<Response> {
    log::debug!("Read the novel file {}", path);
    let is_open_novel = {
        let state_lock = state.read().await;
        state_lock.service_for(path)
    }
    .is_some_and(|service| service.container().is_novel());
    if !is_open_novel {
        return Err(stale(path, "the novel file"));
    }

    let path_owned = path.to_string();
    // On a blocking thread: an EPUB can be large, and other IPC calls must not wait on it.
    let bytes = run_blocking(move || std::fs::read(path_owned)).await?;
    Ok(Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use mockall::predicate::eq;

    use super::*;
    use std::sync::Arc;
    use tauri::{ipc::InvokeResponseBody::Raw, ipc::IpcResponse, Manager};
    use tokio::sync::RwLock;

    use crate::{
        container::traits::{MockContainer, MockPageReader, PageData, PageReader},
        image::{resizer::ResizeFilter, types::Image},
        page::{
            pipeline::Pipeline,
            service::{close_if_stuck, PageService, StuckWatch},
        },
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
            reader
                .expect_read_page()
                .returning(|_| Ok(PageData::Encoded(dummy_page())));
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        container
    }

    /// Installs `container` as the open book under `book_id`.
    ///
    /// The returned watch closes the book if the test outlives the scheduler's test timeout.
    fn manage_service(
        app: &tauri::App<tauri::test::MockRuntime>,
        book_id: &str,
        container: MockContainer,
    ) -> StuckWatch {
        let mut container_state = ContainerState::default();
        container_state.install(PageService::new(
            book_id.to_string(),
            Arc::new(container),
            Pipeline {
                display: None,
                max_image_height: 2000,
                resize_method: ResizeFilter::Bilinear,
            },
            mini_moka::sync::Cache::new(100),
            0,
        ));
        let watch = close_if_stuck(&container_state.current_service().expect("a book is open"));
        app.manage(RwLock::new(container_state));
        watch
    }

    /// A valid 1x1 PNG. A preview is decoded by `Pipeline::preview`, so a preview
    /// fixture has to be a real image.
    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    #[tokio::test]
    async fn test_get_image_in_container() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(
            &app,
            "dummy_book_id",
            page_container(&["test1.png", "test2.png"]),
        );

        // The path must match the service's book_id ("dummy_book_id"): `service_for`
        // rejects a request whose path disagrees with the open book.
        let result = get_image("dummy_book_id", "test1.png", 1, app.state()).await;

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
        // book switch; it must be rejected (BookChanged), not served another book's page.
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "current_book_id", page_container(&["test1.png"]));

        // Ask for a page in a *different* book than the one installed.
        let result = get_image("stale_book_id", "test1.png", 1, app.state()).await;

        let Err(err) = result else {
            panic!("a stale-path get_image should be rejected");
        };
        assert!(
            matches!(err, Error::BookChanged(_)),
            "unexpected error: {err}"
        );
    }

    /// Builds a container state around a two-page book whose pages differ in orientation.
    fn manage_mock_state(app: &tauri::App<tauri::test::MockRuntime>, book_id: &str) -> StuckWatch {
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
        manage_service(app, book_id, container)
    }

    #[tokio::test]
    async fn test_get_image_dimensions_returns_one_entry_per_page() {
        let app = tauri::test::mock_app();
        let _watch = manage_mock_state(&app, "dummy_book_id");

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
        let _watch = manage_mock_state(&app, "current_book_id");

        let result = get_image_dimensions("stale_book_id", app.state()).await;

        let Err(err) = result else {
            panic!("a stale-path get_image_dimensions should be rejected");
        };
        assert!(
            matches!(err, Error::BookChanged(_)),
            "unexpected error: {err}"
        );
    }

    #[tokio::test]
    async fn test_get_image_dimensions_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(ContainerState::default()));

        let result = get_image_dimensions("non_existent_path", app.state()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_image_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(ContainerState::default()));

        let result = get_image("non_existent_path", "image.png", 1, app.state()).await;

        assert!(result.is_err());
    }

    /// The page size `get_image` answered with.
    fn page_size(response: tauri::ipc::Response) -> (u32, u32) {
        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        (
            u32::from_be_bytes([body[0], body[1], body[2], body[3]]),
            u32::from_be_bytes([body[4], body[5], body[6], body[7]]),
        )
    }

    #[tokio::test]
    async fn the_loupe_reads_the_page_at_its_full_size() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "dummy_book_id", page_container(&["test1.png"]));
        set_display_size(400, 300, app.state()).await.unwrap();

        let displayed = get_image("dummy_book_id", "test1.png", 1, app.state())
            .await
            .expect("read the displayed page");
        let magnified = get_image_full("dummy_book_id", "test1.png", app.state())
            .await
            .expect("read the full-size page");

        // Magnifying the fitted page would only upscale what is already on screen.
        assert_eq!(page_size(displayed), (400, 300));
        assert_eq!(page_size(magnified), (800, 600));
    }

    #[tokio::test]
    async fn a_stale_path_is_refused_a_full_size_page() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "current_book_id", page_container(&["test1.png"]));

        // The loupe is held open across a book switch as readily as any other request.
        let result = get_image_full("stale_book_id", "test1.png", app.state()).await;
        assert!(matches!(result, Err(Error::BookChanged(_))));
    }

    #[tokio::test]
    async fn reporting_the_viewport_fits_the_open_book_to_it() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "dummy_book_id", page_container(&["test1.png"]));

        // The mock page is 800x600, and the reader is drawing into a quarter of that.
        set_display_size(400, 300, app.state()).await.unwrap();

        let response = get_image("dummy_book_id", "test1.png", 1, app.state())
            .await
            .expect("read the page");
        assert_eq!(page_size(response), (400, 300));
    }

    #[tokio::test]
    async fn a_viewport_of_zero_unbounds_the_page() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "dummy_book_id", page_container(&["test1.png"]));
        set_display_size(400, 300, app.state()).await.unwrap();

        // What the frontend reports before it has measured anything. The page must come
        // back whole rather than fitted into a zero-sized box.
        set_display_size(0, 0, app.state()).await.unwrap();
        let response = get_image("dummy_book_id", "test1.png", 1, app.state())
            .await
            .expect("read the page");
        assert_eq!(page_size(response), (800, 600));
    }

    #[tokio::test]
    async fn the_viewport_is_recorded_with_no_book_open() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(ContainerState::default()));

        // The window is measured before a book is opened, and the size has to survive
        // until one is: it belongs to the window, not to the book.
        set_display_size(400, 300, app.state()).await.unwrap();

        let state: tauri::State<'_, RwLock<ContainerState>> = app.state();
        assert_eq!(
            state.read().await.display_size,
            Some(Fit {
                width: 400,
                height: 300
            })
        );
    }

    #[tokio::test]
    async fn test_request_preload_around() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "dummy_book_id", page_container(&["test1.png"]));

        let result = request_preload_around("dummy_book_id", 0, 5, 0, app.state()).await;
        assert!(result.is_ok());

        // Preloading is subject to the same check as every other request: the frontend
        // issues it on every page turn, so it is the one most likely to race a switch.
        let stale = request_preload_around("stale_book_id", 0, 5, 0, app.state()).await;
        assert!(matches!(stale, Err(Error::BookChanged(_))));
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
                .returning(|_| Ok(Some(PageData::Encoded(DUMMY_PNG_DATA.to_vec()))));
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        let _watch = manage_service(&app, "dummy_book_id", container);

        let result = get_image_preview("dummy_book_id", "test1.png", 1, app.state()).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        assert!(
            body.ends_with(&[0xFF, 0xD9]),
            "a JPEG made from the reader's preview"
        );
        assert!(!body.ends_with(DUMMY_PNG_DATA));
        // The width and height header: a preview smaller than PREVIEW is not upscaled.
        assert_eq!(&body[..8], &[0, 0, 0, 1, 0, 0, 0, 1]);
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
        let _watch = manage_service(&app, "dummy_book_id", container);

        let result = get_image_preview("dummy_book_id", "test1.png", 1, app.state()).await;
        let body = match result.unwrap().body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        // An empty response is the wire form of "no preview"; the frontend stops asking.
        assert!(body.is_empty());
    }

    #[tokio::test]
    async fn a_stale_generation_is_refused_by_both_page_commands() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "dummy_book_id", page_container(&["test1.png"]));

        assert!(get_image("dummy_book_id", "test1.png", 5, app.state())
            .await
            .is_ok());
        assert!(matches!(
            get_image("dummy_book_id", "test1.png", 4, app.state()).await,
            Err(Error::RequestCancelled(_))
        ));
        assert!(matches!(
            get_image_preview("dummy_book_id", "test1.png", 4, app.state()).await,
            Err(Error::RequestCancelled(_))
        ));
    }

    #[test]
    fn image_response_matches_the_shared_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../src/test/fixtures/binaryPayloads.json"
        )))
        .unwrap();
        let image = &fixture["image"];
        let data: Vec<u8> = serde_json::from_value(image["data"].clone()).unwrap();
        let expected: Vec<u8> = serde_json::from_value(image["bytes"].clone()).unwrap();

        let response = image_response(&Image {
            data,
            width: image["width"].as_u64().unwrap() as u32,
            height: image["height"].as_u64().unwrap() as u32,
        });

        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        assert_eq!(body, expected);
    }

    /// A novel container as `manage_service` needs it: no pages, one reader at most.
    fn novel_container(is_novel: bool) -> MockContainer {
        let mut container = MockContainer::new();
        container
            .expect_get_entries()
            .return_const(Vec::<String>::new());
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_is_novel().return_const(is_novel);
        container
    }

    #[tokio::test]
    async fn test_read_novel_file_returns_the_open_novel() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("novel.epub");
        std::fs::write(&path, b"epub-bytes").unwrap();
        let path = path.to_string_lossy().to_string();
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, &path, novel_container(true));

        let response = read_novel_file(&path, app.state()).await.unwrap();

        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        assert_eq!(body.as_slice(), b"epub-bytes");
    }

    #[tokio::test]
    async fn test_read_novel_file_refuses_a_book_that_is_not_open() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "open.epub", novel_container(true));

        let result = read_novel_file("other.epub", app.state()).await;

        assert!(matches!(result, Err(Error::BookChanged(_))));
    }

    #[tokio::test]
    async fn test_read_novel_file_refuses_a_comic() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "comic.cbz", novel_container(false));

        let result = read_novel_file("comic.cbz", app.state()).await;

        assert!(matches!(result, Err(Error::BookChanged(_))));
    }

    #[tokio::test]
    async fn test_read_novel_file_reports_a_deleted_file_as_not_found() {
        let app = tauri::test::mock_app();
        let _watch = manage_service(&app, "/no/such/novel.epub", novel_container(true));

        let result = read_novel_file("/no/such/novel.epub", app.state()).await;

        assert!(matches!(result, Err(Error::PathNotFound(_))));
    }
}
