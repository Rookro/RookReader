use std::{
    fmt::{Display, Formatter},
    io::Cursor,
    sync::Arc,
};

use image::ImageReader;
use serde::{Deserialize, Serialize};

/// Image data
#[derive(Serialize, Deserialize, Clone)]
pub struct Image {
    /// Binary data of the image
    pub data: Vec<u8>,
    /// Width of the image
    pub width: u32,
    /// Height of the image
    pub height: u32,
}

impl Image {
    /// Creates an Image instance from binary image data.
    ///
    /// * `data` - The binary data of the image.
    pub fn new(data: Vec<u8>) -> Result<Self, String> {
        let cursor = Cursor::new(&data);
        let image_reader = ImageReader::new(cursor)
            .with_guessed_format()
            .map_err(|e| format!("Failed to create Image instance. {}", e))?;
        match image_reader.into_dimensions() {
            Ok((width, height)) => Ok(Image {
                data: data,
                width,
                height,
            }),
            Err(e) => {
                let error_message = format!("Failed to get image size. {}", e);
                log::error!("{}", error_message);
                return Err(error_message);
            }
        }
    }

    /// Checks if the file extention is the supported image format.
    ///
    /// Supported image formats are based on [MDN's <img> supported image formats](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#supported_image_formats).
    /// This method is case-insensitive.
    ///
    /// * `filename` - The filename.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        lowercase_name.ends_with(".apng")
            // image が avif の場合に外部ライブラリーに依存するため非対応とする
            //|| lowercase_name.ends_with(".avif")
            || lowercase_name.ends_with(".gif")
            || lowercase_name.ends_with(".jpg")
            || lowercase_name.ends_with(".jpeg")
            || lowercase_name.ends_with(".jpe")
            || lowercase_name.ends_with(".jif")
            || lowercase_name.ends_with(".jfif")
            || lowercase_name.ends_with(".png")
            || lowercase_name.ends_with(".svg")
            || lowercase_name.ends_with(".webp")
    }
}

/// Archive container
pub trait Container: Send + Sync + 'static {
    /// Retrieves a list of entries contained within the container.
    fn get_entries(&self) -> &Vec<String>;

    /// Retrieves an image from the cache.
    ///
    /// Returns `Arc<Image>` if the image is in the cache.
    ///
    /// * `entry` - The entry name of the image to retrieve.
    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError>;

    /// Retrieves an image from the file.
    ///
    /// * `entry` - The entry name of the image to retrieve.
    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError>;

    /// Preloads a specified number of images into the cache starting from a given index.
    ///
    /// * `begin_index` - The starting index.
    /// * `count` - The number of images to load.
    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError>;
}

impl dyn Container {
    /// Checks if the file extention is the supported archive format.
    ///
    /// The check is case-insensitive.
    ///
    /// * `filename` - The filename.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        lowercase_name.ends_with(".pdf")
            || lowercase_name.ends_with(".rar")
            || lowercase_name.ends_with(".zip")
    }
}

/// Error information for the archive container.
pub struct ContainerError {
    /// Error message
    pub message: String,
    /// Path where the error occurred
    pub path: Option<String>,
    /// Entry where the error occurred
    pub entry: Option<String>,
}

impl Display for ContainerError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} (path: {}, entry: {})",
            self.message,
            self.path.clone().unwrap_or(String::from("None")),
            self.entry.clone().unwrap_or(String::from("None"))
        )?;
        Ok(())
    }
}
