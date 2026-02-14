use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use tauri::ipc::Response;

use crate::{
    container::epub_container::EpubContainer,
    error::{Error, Result},
    state::app_state::AppState,
};

/// The result of getting entries in a container.
#[derive(Serialize, Deserialize)]
pub struct EntriesResult {
    /// The entry names in the container.
    entries: Vec<String>,
    /// Whether the container is a directory.
    is_directory: bool,
}

/// Opens a container file (e.g., ZIP, RAR) and retrieves a list of its contents.
///
/// This function opens the container specified by the `path`, reads the list of file entries
/// within it, and triggers a preload of the image data for faster access.
///
/// # Arguments
///
/// * `path` - The file path to the container to open.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` with an `EntriesResult` struct containing the list of entry
/// names and a boolean indicating if the path is a directory.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `AppState` mutex cannot be locked.
/// * The container file cannot be opened (e.g., it does not exist or is corrupt).
/// * The `container` or `image_loader` within the application state is unexpectedly missing.
/// * Preloading the image data fails.
#[tauri::command()]
pub async fn get_entries_in_container(
    path: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<EntriesResult> {
    log::debug!("Get the entries in {}", path);
    let mut state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    state_lock.container_state.open_container(&path)?;

    let entries;
    let is_directory;
    {
        let container = state_lock
            .container_state
            .container
            .as_ref()
            .ok_or_else(|| Error::Other("Unexpected error. Container is empty!".to_string()))?;
        entries = container.get_entries().clone();
        is_directory = container.is_directory();
    }

    {
        let image_loader = state_lock
            .container_state
            .image_loader
            .as_mut()
            .ok_or_else(|| Error::Other("Unexpected error. ImageLoader is empty!".to_string()))?;
        image_loader.request_preload(0, entries.len())?;
    }

    Ok(EntriesResult {
        entries,
        is_directory,
    })
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
/// * The `AppState` mutex cannot be locked.
/// * The `image_loader` within the application state is unexpectedly missing.
/// * The requested image entry cannot be found or decoded.
#[tauri::command]
pub async fn get_image(
    path: String,
    entry_name: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Response> {
    log::debug!("Get the binary of {} in {}", entry_name, path);

    let mut state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    let image_loader = state_lock
        .container_state
        .image_loader
        .as_mut()
        .ok_or_else(|| Error::Other("Unexpected error. Container is empty!".to_string()))?;

    let image = image_loader.get_image(&entry_name)?;

    // Uses tauri::ipc::Response with a custom binary format to accelerate image data transfer.
    let mut response_data = Vec::with_capacity(8 + image.data.len());
    response_data.extend_from_slice(&image.width.to_be_bytes());
    response_data.extend_from_slice(&image.height.to_be_bytes());
    response_data.extend_from_slice(&image.data);

    Ok(Response::new(response_data))
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
/// * The `AppState` mutex cannot be locked.
/// * The `image_loader` within the application state is unexpectedly missing.
/// * The preview image cannot be retrieved or generated.
#[tauri::command]
pub async fn get_image_preview(
    path: String,
    entry_name: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Response> {
    log::debug!("Get the preview binary of {} in {}", entry_name, path);

    let state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    let image_loader = state_lock
        .container_state
        .image_loader
        .as_ref()
        .ok_or_else(|| Error::Other("Unexpected error. Container is empty!".to_string()))?;

    let Some(image) = image_loader.get_preview_image(&entry_name)? else {
        // Return an empty response if preview skipped.
        return Ok(Response::new(Vec::new()));
    };

    // Uses tauri::ipc::Response with a custom binary format to accelerate image data transfer.
    let mut response_data = Vec::with_capacity(8 + image.data.len());
    response_data.extend_from_slice(&image.width.to_be_bytes());
    response_data.extend_from_slice(&image.height.to_be_bytes());
    response_data.extend_from_slice(&image.data);

    Ok(Response::new(response_data))
}

/// Sets the rendering height for pages in PDF files.
///
/// This height is used when converting a PDF page into an image.
///
/// # Arguments
///
/// * `height` - The target height in pixels for the rendered PDF page image. Must be greater than 0.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` on successful update.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `height` is less than 1.
/// * The `AppState` mutex cannot be locked.
#[tauri::command()]
pub fn set_pdf_rendering_height(
    height: i32,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<()> {
    log::debug!("set_pdf_rendering_height({})", height);

    if height < 1 {
        return Err(Error::Other(
            "pdf rendering height must be greater than 0. set_pdf_rendering_height() is Failed."
                .to_string(),
        ));
    }

    let mut state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    state_lock.container_state.settings.pdf_rendering_height = height;
    Ok(())
}

/// Sets the maximum height for loaded images.
///
/// Images exceeding this height will be resized down to fit.
///
/// # Arguments
///
/// * `height` - The maximum image height in pixels. A value of 0 implies no limit.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` on successful update.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `height` is a negative value.
/// * The `AppState` mutex cannot be locked.
#[tauri::command()]
pub fn set_max_image_height(height: i32, state: tauri::State<'_, Mutex<AppState>>) -> Result<()> {
    log::debug!("set_max_image_height({})", height);

    if height < 0 {
        return Err(Error::Other(
            "Max image height must be greater than or equal to 0. set_max_image_height() is Failed."
                .to_string(),
        ));
    }

    let mut state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    state_lock.container_state.settings.max_image_height = height;
    Ok(())
}

/// Sets the algorithm used for resizing images.
///
/// # Arguments
///
/// * `method` - A string representing the desired resizing filter.
///   Valid options are: "nearest", "triangle", "catmullRom", "gaussian", "lanczos3".
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` on successful update.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `method` string is empty.
/// * The `method` does not match one of the valid filter types.
/// * The `AppState` mutex cannot be locked.
#[tauri::command()]
pub fn set_image_resize_method(
    method: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<()> {
    log::debug!("set_image_resize_method({})", method);

    if method.is_empty() {
        return Err(Error::Other(
            "Method must be provided. set_image_resize_method() is Failed.".to_string(),
        ));
    }

    let mut state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    let method = match method.as_str() {
        "nearest" => FilterType::Nearest,
        "triangle" => FilterType::Triangle,
        "catmullRom" => FilterType::CatmullRom,
        "gaussian" => FilterType::Gaussian,
        "lanczos3" => FilterType::Lanczos3,
        _ => return Err(Error::Other("Invalid Resize Method type".to_string())),
    };

    state_lock.container_state.settings.image_resize_method = method;
    Ok(())
}

/// Determines if the file at the given path is an EPUB file containing a novel.
///
/// This function checks the file extension and then inspects the EPUB's contents to
/// distinguish text-based novels from image-based comics.
///
/// # Arguments
///
/// * `path` - The file path to the EPUB file to be checked.
/// * `state` - A `tauri::State` holding the application's global `AppState`.
///
/// # Returns
///
/// A `Result` which is `Ok` with a boolean: `true` if the file is a novel EPUB, `false` otherwise.
///
/// # Errors
///
/// This function will return an `Err` if:
/// * The `AppState` mutex cannot be locked.
/// * The file at `path` cannot be opened or is not a valid EPUB file.
#[tauri::command()]
pub async fn determine_epub_novel(
    path: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<bool> {
    let mut state_lock = state
        .lock()
        .map_err(|e| Error::Mutex(format!("Failed to lock AppState. {}", e)))?;

    state_lock.container_state.container = None;
    state_lock.container_state.image_loader = None;

    let is_epub = Path::new(&path)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase()
        == "epub";

    if !is_epub {
        return Ok(false);
    }

    let container = Arc::new(EpubContainer::new(&path)?);
    Ok(container.is_novel())
}

#[cfg(test)]
mod tests {
    use mockall::predicate::eq;
    use rstest::rstest;

    use super::*;
    use std::{
        path,
        sync::{Arc, Mutex},
    };
    use tauri::{ipc::InvokeResponseBody::Raw, ipc::IpcResponse, Manager};

    use crate::{
        container::{container::MockContainer, image::Image, image_loader::ImageLoader},
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

    #[rstest]
    #[case(1200)]
    #[case(100000)]
    fn test_set_pdf_rendering_height_valid_height(#[case] pdf_rendering_height: i32) {
        let app = tauri::test::mock_app();
        app.manage(Mutex::new(AppState::default()));

        let result = set_pdf_rendering_height(pdf_rendering_height, app.state());

        assert!(result.is_ok());
        assert_eq!(
            pdf_rendering_height,
            app.state::<Mutex<AppState>>()
                .lock()
                .unwrap()
                .container_state
                .settings
                .pdf_rendering_height
        );
    }

    #[rstest]
    #[case(0)]
    #[case(-1)]
    #[case(-1200)]
    fn test_set_pdf_rendering_height_negative(#[case] invalid_pdf_rendering_height: i32) {
        let app = tauri::test::mock_app();
        app.manage(Mutex::new(AppState::default()));

        let result = set_pdf_rendering_height(invalid_pdf_rendering_height, app.state());

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_entries_in_container() {
        let dir = tempfile::tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let expected_entries = vec![
            "image1.png".to_string(),
            "image2.png".to_string(),
            "image3.png".to_string(),
        ];

        let app = tauri::test::mock_app();
        app.manage(Mutex::new(AppState::default()));

        let result =
            get_entries_in_container(rar_path.to_string_lossy().to_string(), app.state()).await;

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
        app.manage(Mutex::new(AppState::default()));

        let result = get_entries_in_container("non_existent_path".to_string(), app.state()).await;

        assert!(result.is_err());
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

        let arc_mock_container = Arc::new(mock_container);
        let mock_container_state = ContainerState {
            container: Some(arc_mock_container.clone()),
            settings: ContainerSettings::default(),
            image_loader: Some(ImageLoader::new(
                arc_mock_container.clone(),
                2000,
                FilterType::Triangle,
            )),
        };
        let state = AppState {
            container_state: mock_container_state,
        };
        app.manage(Mutex::new(state));

        let result = get_image(
            "mock_container".to_string(),
            "test1.png".to_string(),
            app.state(),
        )
        .await;

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
        app.manage(Mutex::new(AppState::default()));

        let result = get_image(
            "non_existent_path".to_string(),
            "image.png".to_string(),
            app.state(),
        )
        .await;

        assert!(result.is_err());
    }
}
