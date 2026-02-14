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

/// Gets entries in the specified archive container.
///
/// Returns a list of entry names in the container and whether it's a directory or a file.
///
/// * `path` - The path of the archive container.
/// * `state` - The application state.
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

/// Gets an image in the specified archive container.
///
/// Returns the image data with a custom binary format.
/// The binary format is Big-Endian and structured as follows:
/// \[Width (4 bytes)\]\[Height (4 bytes)\]\[Image Data...\]
///
/// * `path` - The path of the archive container.
/// * `entry_name` - The entry name of the image to get.
/// * `state` - The application state.
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

/// Gets an image preview in the specified archive container.
///
/// Returns the image data with a custom binary format if the image is not cached.
/// The binary format is Big-Endian and structured as follows:
/// \[Width (4 bytes)\]\[Height (4 bytes)\]\[Image Data...\]
/// Returns an empty response if the image is already cached.
///
/// * `path` - The path of the archive container.
/// * `entry_name` - The entry name of the image to get.
/// * `state` - The application state.
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

/// Sets the image height for PDF rendering.
///
/// * `height` - The image height.
/// * `state` - The application state.
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

/// Sets the max image height.
///
/// * `height` - The max image height.
/// * `state` - The application state.
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

/// Determines if the given path is an EPUB novel.
///
/// Note: This function is currently in beta and may be subject to breaking changes
/// in future releases.
///
/// Returns `true` if the file is an EPUB novel, `false` otherwise.
///
/// * `path` - The path to the file.
/// * `state` - The application state.
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
