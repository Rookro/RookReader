use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use pdfium_render::prelude::{PdfDocument, PdfRenderConfig, Pdfium};
use std::{fs::File, io::Read, sync::Arc};

use crate::container::{
    container::{Container, ContainerError, ContainerResult},
    image::Image,
};

/// A container for PDF archives.
pub struct PdfContainer {
    /// Pdf binary data.
    pdf_binary: Vec<u8>,
    /// The entries in the container.
    entries: Vec<String>,
    /// Pdf rendering config.
    render_config: Arc<PdfRenderConfig>,
    /// The path to the pdfium library.
    library_path: Option<String>,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &String) -> ContainerResult<Arc<Image>> {
        let pdfium = get_pdfium(&self.library_path)?;
        let pdf = pdfium.load_pdf_from_byte_slice(&self.pdf_binary, None)?;

        let image_arc = load_image(&pdf, &self.render_config, entry)?;
        Ok(image_arc)
    }
}

impl PdfContainer {
    /// Creates a new instance.
    ///
    /// * `path` - The path to the container file.
    /// * `render_config` - The pdf rendering config.
    /// * `library_path` - The path to the pdfium library. Uses default path if None.
    pub fn new(
        path: &String,
        render_config: PdfRenderConfig,
        library_path: Option<String>,
    ) -> ContainerResult<Self> {
        let mut buffer = Vec::new();
        File::open(path)?.read_to_end(&mut buffer)?;

        let mut entries: Vec<String> = Vec::new();
        {
            let pdfium = get_pdfium(&library_path)?;
            let pdf = pdfium.load_pdf_from_byte_slice(&buffer, None)?;

            for index in 0..pdf.pages().len() {
                entries.push(format!("{:0>4}", index));
            }
        }

        Ok(Self {
            pdf_binary: buffer,
            entries,
            render_config: Arc::new(render_config),
            library_path,
        })
    }
}

/// Loads an image from the specified entry name.
///
/// * `pdf` - The pdf document.
/// * `render_config` - The pdf rendering config.
/// * `entry` - The entry name of the image to get.
fn load_image(
    pdf: &PdfDocument,
    render_config: &PdfRenderConfig,
    entry: &String,
) -> ContainerResult<Arc<Image>> {
    let index: u16 = entry.parse()?;

    let page = pdf
        .pages()
        .get(index)
        .map_err(|e| ContainerError::Pdfium(e))?;
    let img = page.render_with_config(render_config)?.as_image();

    let mut buffer = Vec::new();
    let encoder = PngEncoder::new(&mut buffer);
    encoder.write_image(
        img.as_bytes(),
        img.width(),
        img.height(),
        ExtendedColorType::from(img.color()),
    )?;

    let image = Image {
        data: buffer,
        width: img.width(),
        height: img.height(),
    };

    Ok(Arc::new(image))
}

/// Gets a pdfium instance.
///
/// * `library_path` - The path to the pdfium library. Uses default path if None.
fn get_pdfium(library_path: &Option<String>) -> ContainerResult<Pdfium> {
    if let Some(lib_path) = library_path {
        let lib_name = Pdfium::pdfium_platform_library_name_at_path(lib_path);
        let bindings = Pdfium::bind_to_library(lib_name)?;
        Ok(Pdfium::new(bindings))
    } else {
        Ok(Pdfium::default())
    }
}

#[cfg(test)]
mod tests {
    use std::{env, fs::File, io::Write, path};
    use tempfile::tempdir;

    use super::*;

    pub fn get_pdfium_lib_path() -> String {
        let pdfium_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("dependencies")
            .join("pdfium");

        let lib_path = if pdfium_path.clone().join("bin").exists() {
            pdfium_path.clone().join("bin")
        } else {
            pdfium_path.clone().join("lib")
        };

        lib_path.to_string_lossy().to_string()
    }

    // A minimal 1-page PDF file content
    const SINGLE_PAGE_PDF_DATA: &[u8] = b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count 1 /Kids [ 3 0 R ] >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000057 00000 n\n0000000107 00000 n\ntrailer << /Size 4 /Root 1 0 R >> startxref\n157\n%%EOF\n";

    // Create a dummy PDF file for testing.
    fn create_dummy_pdf(dir: &path::Path, filename: &str) -> path::PathBuf {
        let filepath = dir.join(filename);
        let mut file = File::create(&filepath).unwrap();
        file.write_all(SINGLE_PAGE_PDF_DATA).unwrap();
        filepath
    }

    #[test]
    fn test_new_valid_pdf() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let render_config = PdfRenderConfig::default();
        let container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        assert_eq!(container.entries.len(), 1);
        assert_eq!(container.entries[0], "0000");
    }

    #[test]
    fn test_new_non_existent_pdf() {
        let non_existent_path = String::from("/non/existent/file.pdf");
        let render_config = PdfRenderConfig::default();
        let container = PdfContainer::new(
            &non_existent_path,
            render_config,
            Some(get_pdfium_lib_path()),
        );

        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let render_config = PdfRenderConfig::default();
        let container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0], "0000");
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let rendering_height: u32 = 100;
        let render_config = PdfRenderConfig::default().set_target_height(rendering_height as i32);
        let container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let image = container.get_image(&String::from("0000")).unwrap();

        assert!(image.width > 0);
        assert_eq!(rendering_height, image.height);
        assert!(!image.data.is_empty());
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let rendering_height = 100;
        let render_config = PdfRenderConfig::default().set_target_height(rendering_height);
        let container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let result = container.get_image(&String::from("0001")); // Page 1 does not exist
        assert!(result.is_err());
    }
}
