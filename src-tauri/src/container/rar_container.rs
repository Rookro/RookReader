use unrar::{Archive, CursorBeforeHeader, OpenArchive, Process};

use std::sync::Arc;

use crate::container::{
    container::{Container, ContainerError, ContainerResult},
    image::Image,
};

/// A container for RAR archives.
pub struct RarContainer {
    /// The file path of the container.
    path: String,
    /// The entries in the container.
    entries: Vec<String>,
}

impl Container for RarContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &String) -> ContainerResult<Arc<Image>> {
        let mut archive = open(&self.path)?;
        while let Some(header) = archive.read_header()? {
            let filename = header.entry().filename.to_string_lossy().to_string();
            if filename == *entry {
                let (data, rest) = header.read()?;
                drop(rest); // close the archive
                let img = Image::new(data)?;
                return Ok(Arc::new(img));
            } else {
                archive = header.skip()?;
            }
        }

        Err(ContainerError::Other(format!("Entry not found: {}", entry)))
    }
}

impl RarContainer {
    /// Creates a new instance.
    ///
    /// * `path` - The path to the container file.
    pub fn new(path: &String) -> ContainerResult<Self> {
        let archive = Archive::new(path).open_for_listing()?;

        let mut entries: Vec<String> = Vec::new();
        for entry_result in archive {
            let entry = entry_result?;
            if entry.is_file() {
                let filename = entry.filename.to_string_lossy().to_string();
                if Image::is_supported_format(&filename) {
                    entries.push(filename);
                }
            }
        }

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            path: path.clone(),
            entries,
        })
    }
}

/// Opens a RAR archive from the specified path.
///
/// * `path` - The path to the RAR file.
fn open(path: &String) -> ContainerResult<OpenArchive<Process, CursorBeforeHeader>> {
    Ok(Archive::new(path).open_for_processing()?)
}

#[cfg(test)]
mod tests {
    use std::path;
    use tempfile::tempdir;

    use super::*;

    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8,
        0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x53, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
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
        std::fs::copy(dummy_rar_path, &rar_filepath).expect("failed to copy dummy rar file");
        rar_filepath
    }

    #[test]
    fn test_new_valid_rar() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");

        let container = RarContainer::new(&rar_path.to_string_lossy().to_string())
            .expect("failed to create RarContainer");

        assert_eq!(container.path, rar_path.to_string_lossy().to_string());
        // Expecting 2 entries based on the dummy.rar creation instructions
        assert_eq!(container.entries.len(), 3);
        assert!(container.entries.contains(&String::from("image1.png")));
        assert!(container.entries.contains(&String::from("image2.png")));
        assert!(container.entries.contains(&String::from("image3.png")));
    }

    #[test]
    fn test_new_non_existent_rar() {
        let non_existent_path = String::from("/non/existent/file.rar");
        let container = RarContainer::new(&non_existent_path);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(&rar_path.to_string_lossy().to_string())
            .expect("failed to create RarContainer");
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert!(entries.contains(&String::from("image1.png")));
        assert!(entries.contains(&String::from("image2.png")));
        assert!(entries.contains(&String::from("image3.png")));
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(&rar_path.to_string_lossy().to_string())
            .expect("failed to create RarContainer");

        // Assuming 'image1.png' exists in dummy.rar and is a valid image
        let image = container
            .get_image(&String::from("image1.png"))
            .expect("get_image should succeed for existing image");
        assert!(image.width > 0);
        assert!(image.height > 0);
        assert!(!image.data.is_empty());
        assert_eq!(image.data, DUMMY_PNG_DATA);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(&rar_path.to_string_lossy().to_string())
            .expect("failed to create RarContainer");
        let result = container.get_image(&String::from("non_existent_image.png"));
        assert!(result.is_err());
    }
}
