use std::sync::{Arc, Mutex};

use tauri::ipc::Response;

use crate::{container::image::Image, state::app_state::AppState};

/// Gets entries in the specified archive container.
///
/// Returns a list of entry names in the directory.
///
/// * `path` - The path of the archive container.
/// * `state` - The application state.
#[tauri::command()]
pub fn get_entries_in_container(
    path: String,
    state: tauri::State<Mutex<AppState>>,
) -> Result<Vec<String>, String> {
    log::debug!("Get the entries in {}", path);
    let mut state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    state_lock
        .container_state
        .open_container(&path)
        .map_err(|e| format!("Failed to get entries in the container. {}", e))?;

    if let Some(container) = state_lock.container_state.container.as_mut() {
        container
            .request_preload(0, container.get_entries().len())
            .map_err(|e| {
                log::error!("Failed to start preloading. {}", e);
                format!("Failed to start preloading. {}", e)
            })?;
        Ok(container.get_entries().clone())
    } else {
        log::error!("Unexpected error. Container is empty!");
        Err(String::from("Unexpected error. Container is empty!"))
    }
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
pub fn get_image(
    path: String,
    entry_name: String,
    state: tauri::State<Mutex<AppState>>,
) -> Result<Response, String> {
    log::debug!("Get the binary of {} in {}", entry_name, path);

    let mut state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    let image: Arc<Image> = if let Some(container) = &mut state_lock.container_state.container {
        container
            .get_image(&entry_name)
            .map_err(|e| format!("Failed to get image. {}", e))?
    } else {
        log::error!("Unexpected error. Container is empty!");
        return Err(String::from("Unexpected error. Container is empty!"));
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
) -> Result<(), String> {
    log::debug!("set_pdf_rendering_height({})", height);

    if height < 1 {
        return Err(
            "pdf rendering height must be greater than 0. set_pdf_rendering_height() is Failed."
                .to_string(),
        );
    }

    let mut state_lock = state.lock().map_err(|e| {
        log::error!("Failed to lock AppState. {}", e.to_string());
        format!("Failed to lock AppState. {}", e.to_string())
    })?;

    state_lock.container_state.settings.pdf_rendering_height = height;
    Ok(())
}

#[cfg(test)]
mod tests {
    use mockall::predicate::eq;
    use rstest::rstest;

    use super::*;
    use std::{path, sync::Mutex};
    use tauri::{ipc::InvokeResponseBody::Raw, ipc::IpcResponse, Manager};

    use crate::{
        container::container::MockContainer, setting::container_settings::ContainerSettings,
        state::container_state::ContainerState,
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

    #[test]
    fn test_get_entries_in_container() {
        let dir = tempfile::tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let expected_entries = vec![
            "image1.png".to_string(),
            "image2.png".to_string(),
            "image3.png".to_string(),
        ];

        let app = tauri::test::mock_app();
        app.manage(Mutex::new(AppState::default()));

        let result = get_entries_in_container(rar_path.to_str().unwrap().to_string(), app.state());

        assert!(result.is_ok());

        let actual_entries = result.unwrap();
        assert_eq!(expected_entries.len(), actual_entries.len());
        assert_eq!(expected_entries[0], actual_entries[0]);
        assert_eq!(expected_entries[1], actual_entries[1]);
        assert_eq!(expected_entries[2], actual_entries[2]);
    }

    #[test]
    fn test_get_entries_in_container_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(Mutex::new(AppState::default()));

        let result = get_entries_in_container("non_existent_path".to_string(), app.state());

        assert!(result.is_err());
    }

    #[test]
    fn test_get_image_in_container() {
        let app = tauri::test::mock_app();
        let mut mock_container = MockContainer::new();
        mock_container
            .expect_get_image()
            .with(eq("test1.png".to_string()))
            .times(1)
            .returning(|_entry| Ok(MockContainer::create_dummy_image()));

        let mock_container_state = ContainerState {
            container: Some(Box::new(mock_container)),
            settings: ContainerSettings::default(),
        };
        let state = AppState {
            container_state: mock_container_state,
        };
        app.manage(Mutex::new(state));

        let result = get_image(
            "mock_container".to_string(),
            "test1.png".to_string(),
            app.state(),
        );

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

    #[test]
    fn test_get_image_empty_container() {
        let app = tauri::test::mock_app();
        app.manage(Mutex::new(AppState::default()));

        let result = get_image(
            "non_existent_path".to_string(),
            "image.png".to_string(),
            app.state(),
        );

        assert!(result.is_err());
    }
}
