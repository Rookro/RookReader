use image::codecs::jpeg::JpegEncoder;
use pdfium_render::prelude::{PdfDocument, PdfPageRenderRotation, PdfRenderConfig, Pdfium};
use std::sync::Arc;

use crate::{
    container::{image::Image, traits::Container},
    error::{Error, Result},
};

/// An implementation of the `Container` trait for reading content from PDF files.
///
/// This container treats each page of a PDF document as an entry, which can be
/// rendered into an image.
pub struct PdfContainer {
    /// The file path of the PDF container.
    path: String,
    /// A list of page numbers (as zero-padded strings) representing the entries.
    entries: Vec<String>,
    /// The configuration used for rendering full-sized page images.
    render_config: Arc<PdfRenderConfig>,
    /// The path to the directory containing the `pdfium` dynamic library.
    library_path: Option<String>,
    /// The configuration used for rendering smaller thumbnail images.
    thumbnail_render_config: Arc<PdfRenderConfig>,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &str) -> Result<Arc<Image>> {
        let pdfium = get_pdfium(&self.library_path)?;
        let pdf = pdfium.load_pdf_from_file(&self.path, None)?;

        let image_arc = load_image(&pdf, &self.render_config, entry)?;
        Ok(image_arc)
    }

    fn get_thumbnail(&self, entry: &str) -> Result<Arc<Image>> {
        let pdfium = get_pdfium(&self.library_path)?;
        let pdf = pdfium.load_pdf_from_file(&self.path, None)?;
        create_thumbnail(&pdf, &self.thumbnail_render_config, entry)
    }

    fn is_directory(&self) -> bool {
        false
    }
}

impl PdfContainer {
    /// Creates a new `PdfContainer` from the PDF file at the specified path.
    ///
    /// This constructor initializes the `pdfium` library to open the PDF and
    /// determine the number of pages, which become the entries for this container.
    ///
    /// # Arguments
    ///
    /// * `path` - The path to the PDF file.
    /// * `render_config` - The base configuration for rendering pages.
    /// * `library_path` - An optional path to the directory containing the `pdfium` library.
    ///
    /// # Returns
    ///
    /// A `Result` containing a new `PdfContainer` instance on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if `pdfium` cannot be initialized or the PDF file cannot be opened.
    pub fn new(
        path: &str,
        render_config: PdfRenderConfig,
        library_path: Option<String>,
    ) -> Result<Self> {
        let mut entries: Vec<String> = Vec::new();
        {
            let pdfium = get_pdfium(&library_path)?;
            let pdf = pdfium.load_pdf_from_file(path, None)?;

            for index in 0..pdf.pages().len() {
                entries.push(format!("{:0>4}", index));
            }
        }

        Ok(Self {
            path: path.to_string(),
            entries,
            render_config: Arc::new(render_config),
            library_path,
            thumbnail_render_config: Arc::new(
                PdfRenderConfig::default()
                    .set_target_height(<dyn Container>::THUMBNAIL_SIZE as i32)
                    .rotate(PdfPageRenderRotation::None, false)
                    .use_print_quality(false)
                    .set_image_smoothing(false)
                    .render_annotations(false)
                    .render_form_data(false),
            ),
        })
    }
}

/// Helper function to render a PDF page to an image using a specific config.
fn load_image(
    pdf: &PdfDocument,
    render_config: &PdfRenderConfig,
    entry: &str,
) -> Result<Arc<Image>> {
    let index: u16 = entry.parse()?;

    let page = pdf.pages().get(index).map_err(Error::from)?;
    let img = page.render_with_config(render_config)?.as_image();

    let mut buffer = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 80);
    encoder.encode_image(&img)?;

    let image = Image {
        data: buffer,
        width: img.width(),
        height: img.height(),
    };

    Ok(Arc::new(image))
}

/// Helper function to render a PDF page to a thumbnail image.
fn create_thumbnail(
    pdf: &PdfDocument,
    render_config: &PdfRenderConfig,
    entry: &str,
) -> Result<Arc<Image>> {
    let index: u16 = entry.parse()?;

    let page = pdf.pages().get(index).map_err(Error::from)?;
    // let img = match page.embedded_thumbnail() {
    //     Ok(thumbnail) => thumbnail.as_image(),
    //     Err(_) => page.render_with_config(render_config)?.as_image(),
    // };
    let img = page.render_with_config(render_config)?.as_image();

    let mut buffer = Vec::new();
    // Use a lower quality for thumbnails to make them smaller and faster to encode.
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 10);
    encoder.encode_image(&img)?;

    let image = Image {
        data: buffer,
        width: img.width(),
        height: img.height(),
    };

    Ok(Arc::new(image))
}

/// Initializes the `Pdfium` instance, binding to the library at the given path.
fn get_pdfium(library_path: &Option<String>) -> Result<Pdfium> {
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
            pdf_path.to_string_lossy().as_ref(),
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
            pdf_path.to_string_lossy().as_ref(),
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
            pdf_path.to_string_lossy().as_ref(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let image = container.get_image("0000").unwrap();

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
            pdf_path.to_string_lossy().as_ref(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let result = container.get_image("0001"); // Page 1 does not exist
        assert!(result.is_err());
    }
}
