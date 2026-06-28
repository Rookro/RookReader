use tokio::sync::{Mutex, RwLock};

use serde::{Deserialize, Serialize};
use tauri::ipc::Response;

use crate::{
    error::{Error, Result},
    state::app_state::AppState,
};

/// Serializes container opens so the most recently started one is left installed.
///
/// The heavy build still runs without holding the state write lock (so image fetches
/// aren't blocked); this only orders the opens themselves, preventing a slower earlier
/// open from installing after a newer one.
static OPEN_CONTAINER_LOCK: Mutex<()> = Mutex::const_new(());

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
    let _open_guard = OPEN_CONTAINER_LOCK.lock().await;

    // Build under a read lock so concurrent image fetches (also readers) aren't blocked;
    // only the brief install needs a write lock.
    let built = {
        let state_lock = state.read().await;
        state_lock.container_state.build(path)
    };
    let (container, loader) = match built {
        Ok(built) => built,
        Err(e) => {
            // Clear stale state so a failed open doesn't keep serving the previous book.
            state.write().await.container_state.clear();
            return Err(e);
        }
    };

    let entries = container.get_entries().clone();
    let is_directory = container.is_directory();
    let is_novel = container.is_novel();

    {
        let mut state_lock = state.write().await;
        state_lock.container_state.install(container, loader);
    }

    if !is_novel {
        let state_lock = state.read().await;
        if let Some(loader) = state_lock.container_state.image_loader.as_ref() {
            log::debug!("Triggering proactive preloading for {}", path);
            loader.request_preload_around(0, 5)?;
        }
    }

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
/// * `index` - The current page index around which to preload.
/// * `buffer_size` - Optional. How many pages to preload in each direction.
///   Defaults to 10 if `None` is provided.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
#[tauri::command()]
#[specta::specta]
pub async fn request_preload_around(
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

    let image_loader = state_lock
        .container_state
        .image_loader
        .as_ref()
        .ok_or_else(|| Error::Other("Unexpected error. ImageLoader is empty!".to_string()))?;

    image_loader.request_preload_around(index, buffer_size)?;
    Ok(())
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

    let state_lock = state.read().await;

    let image_loader = state_lock
        .container_state
        .image_loader
        .as_ref()
        .ok_or_else(|| Error::Other("Unexpected error. Container is empty!".to_string()))?;

    let image = image_loader.get_image(entry_name)?;

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

    let state_lock = state.read().await;

    let image_loader = state_lock
        .container_state
        .image_loader
        .as_ref()
        .ok_or_else(|| Error::Other("Unexpected error. Container is empty!".to_string()))?;

    let Some(image) = image_loader.get_preview_image(entry_name)? else {
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
        container::traits::MockContainer,
        image::{loader::ImageLoader, resizer::ResizeFilter, types::Image},
        state::{container_settings::ContainerSettings, container_state::ContainerState},
    };

    impl MockContainer {
        /// Create a dummy image. MockContainer allways return this image.
        fn create_dummy_image() -> Arc<Image> {
            Arc::new(Image {
                data: vec![0u8; 100],
                width: 800,
                height: 600,
            })
        }
    }

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

        // Open a valid container first; state now holds a container + loader.
        get_entries_in_container(rar_path.to_string_lossy().as_ref(), app.state())
            .await
            .expect("opening a valid container should succeed");
        {
            let binding = app.state::<RwLock<AppState>>();
            let guard = binding.read().await;
            assert!(guard.container_state.container.is_some());
            assert!(guard.container_state.image_loader.is_some());
        }

        // A subsequent failed open must clear the previous container/loader so we
        // never serve images from the old book.
        let result = get_entries_in_container("non_existent_path", app.state()).await;
        assert!(result.is_err());
        {
            let binding = app.state::<RwLock<AppState>>();
            let guard = binding.read().await;
            assert!(guard.container_state.container.is_none());
            assert!(guard.container_state.image_loader.is_none());
        }
    }

    #[tokio::test]
    async fn test_get_image_in_container() {
        let app = tauri::test::mock_app();
        let mut mock_container = MockContainer::new();
        mock_container
            .expect_get_image()
            .with(eq("test1.png".to_string()))
            .times(1)
            .returning(|_entry| Ok(MockContainer::create_dummy_image()));
        mock_container
            .expect_get_entries()
            .return_const(vec!["test1.png".to_string(), "test2.png".to_string()]);
        mock_container
            .expect_is_single_threaded()
            .return_const(false);

        let arc_mock_container = Arc::new(mock_container);
        let mock_container_state = ContainerState {
            container: Some(arc_mock_container.clone()),
            settings: ContainerSettings::default(),
            image_loader: Some(
                ImageLoader::new(
                    "dummy_book_id".to_string(),
                    arc_mock_container.clone(),
                    2000,
                    ResizeFilter::Bilinear,
                    mini_moka::sync::Cache::new(100),
                )
                .unwrap(),
            ),
            image_cache: mini_moka::sync::Cache::new(100),
        };
        let state = AppState {
            container_state: mock_container_state,
        };
        app.manage(RwLock::new(state));

        let result = get_image("mock_container", "test1.png", app.state()).await;

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
    async fn test_get_image_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(RwLock::new(AppState::default()));

        let result = get_image("non_existent_path", "image.png", app.state()).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_request_preload_around() {
        let app = tauri::test::mock_app();
        let mut mock_container = MockContainer::new();
        mock_container
            .expect_get_entries()
            .return_const(vec!["test1.png".to_string()]);
        mock_container
            .expect_get_image()
            .returning(|_| Ok(MockContainer::create_dummy_image()));
        mock_container
            .expect_is_single_threaded()
            .return_const(false);

        let arc_mock_container = Arc::new(mock_container);
        let mock_container_state = ContainerState {
            container: Some(arc_mock_container.clone()),
            settings: ContainerSettings::default(),
            image_loader: Some(
                ImageLoader::new(
                    "dummy_book_id".to_string(),
                    arc_mock_container.clone(),
                    2000,
                    ResizeFilter::Bilinear,
                    mini_moka::sync::Cache::new(100),
                )
                .unwrap(),
            ),
            image_cache: mini_moka::sync::Cache::new(100),
        };
        let state = AppState {
            container_state: mock_container_state,
        };
        app.manage(RwLock::new(state));

        let result = request_preload_around(0, Some(5), app.state()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_image_preview() {
        let app = tauri::test::mock_app();
        let mut mock_container = MockContainer::new();
        mock_container
            .expect_get_thumbnail()
            .with(eq("test1.png".to_string()))
            .times(1)
            .returning(|_entry| Ok(MockContainer::create_dummy_image()));
        mock_container
            .expect_get_entries()
            .return_const(vec!["test1.png".to_string()]);
        mock_container
            .expect_is_single_threaded()
            .return_const(false);

        let arc_mock_container = Arc::new(mock_container);
        let mock_container_state = ContainerState {
            container: Some(arc_mock_container.clone()),
            settings: ContainerSettings::default(),
            image_loader: Some(
                ImageLoader::new(
                    "dummy_book_id".to_string(),
                    arc_mock_container.clone(),
                    2000,
                    ResizeFilter::Bilinear,
                    mini_moka::sync::Cache::new(100),
                )
                .unwrap(),
            ),
            image_cache: mini_moka::sync::Cache::new(100),
        };
        let state = AppState {
            container_state: mock_container_state,
        };
        app.manage(RwLock::new(state));

        let result = get_image_preview("mock_container", "test1.png", app.state()).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        let body = match response.body().unwrap() {
            Raw(bytes) => bytes,
            _ => panic!("Unexpected response body type"),
        };
        assert!(!body.is_empty());
    }
}
