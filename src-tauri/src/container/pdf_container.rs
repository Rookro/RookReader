use pdfium_render::prelude::{PdfPageRenderRotation, PdfRenderConfig};
use std::sync::Arc;

use crate::{
    container::{
        pdf_worker::{self, Worker},
        traits::{Container, PageReader},
    },
    error::Result,
    image::types::ImageDimensions,
};

/// An implementation of the `Container` trait for reading content from PDF files.
///
/// This container treats each page of a PDF document as an entry, which can be
/// rendered into an image.
///
/// It holds no pdfium state of its own. `Drop for Pdfium` unloads the library, so exactly
/// one instance may exist in the process; [`crate::container::pdf_worker`] owns it, and
/// everything here is a message to that thread.
pub struct PdfContainer {
    /// The file path of the PDF container.
    path: String,
    /// A list of page numbers (as zero-padded strings) representing the entries.
    entries: Vec<String>,
    /// The configuration used for rendering full-sized page images.
    render_config: Arc<PdfRenderConfig>,
    /// The configuration used for rendering smaller thumbnail images.
    thumbnail_render_config: Arc<PdfRenderConfig>,
    /// The one worker that owns the library.
    worker: &'static Worker,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn is_directory(&self) -> bool {
        false
    }

    fn max_readers(&self) -> usize {
        1
    }

    fn open_reader(&self) -> Result<Box<dyn PageReader>> {
        Ok(Box::new(PdfReader {
            path: self.path.clone(),
            render_config: self.render_config.clone(),
            thumbnail_render_config: self.thumbnail_render_config.clone(),
            worker: self.worker,
        }))
    }
}

/// A reader over one PDF document.
///
/// Like the container, it holds no pdfium state — only the address of the worker and the
/// configs to render with. A second reader would therefore be harmless, but
/// [`Container::max_readers`] still caps this format at one: every request funnels through
/// the single worker thread, so extra readers would only queue behind each other.
struct PdfReader {
    path: String,
    render_config: Arc<PdfRenderConfig>,
    thumbnail_render_config: Arc<PdfRenderConfig>,
    worker: &'static Worker,
}

impl PageReader for PdfReader {
    fn read_page(&mut self, entry: &str) -> Result<Vec<u8>> {
        Ok(self
            .worker
            .render_page(&self.path, parse_index(entry)?, self.render_config.clone())?
            .data)
    }

    fn page_dimensions(&mut self, entry: &str) -> Result<ImageDimensions> {
        self.worker.page_dimensions(&self.path, parse_index(entry)?)
    }

    fn read_preview(&mut self, entry: &str) -> Result<Option<Vec<u8>>> {
        Ok(Some(
            self.worker
                .render_thumbnail(
                    &self.path,
                    parse_index(entry)?,
                    self.thumbnail_render_config.clone(),
                )?
                .data,
        ))
    }
}

impl Drop for PdfReader {
    /// Lets the worker close the document as soon as the book is closed.
    ///
    /// Every other format holds its handles only while the book is open, and PDF must not
    /// be the exception. The worker's cache is bound at two documents, so without this a
    /// closed book's parsed structures and file handle stay resident until two *other*
    /// PDFs displace them.
    fn drop(&mut self) {
        self.worker.release(&self.path);
    }
}

impl PdfContainer {
    /// Creates a new `PdfContainer` from the PDF file at the specified path.
    ///
    /// The page count comes from the worker rather than from a `Pdfium` built here. That
    /// is not tidiness: a local instance would be dropped at the end of this function, and
    /// that drop calls `FPDF_DestroyLibrary()` out from under the worker's live one —
    /// opening a PDF would hang the process.
    ///
    /// # Arguments
    ///
    /// * `path` - The path to the PDF file.
    /// * `render_config` - The base configuration for rendering pages.
    /// * `library_path` - An optional path to the directory containing the `pdfium` library.
    ///   Only the first PDF opened in a process decides this; see [`pdf_worker::worker`].
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
        let worker = pdf_worker::worker(&library_path);
        let entries = (0..worker.page_count(path)?)
            .map(|index| format!("{index:0>4}"))
            .collect();

        Ok(Self {
            path: path.to_string(),
            entries,
            render_config: Arc::new(render_config),
            thumbnail_render_config: Arc::new(
                PdfRenderConfig::default()
                    .set_target_height(crate::image::thumbnail::THUMBNAIL_SIZE as i32)
                    .rotate(PdfPageRenderRotation::None, false)
                    .use_print_quality(false)
                    .set_image_smoothing(false)
                    .render_annotations(false)
                    .render_form_data(false),
            ),
            worker,
        })
    }
}

/// Parses an entry name back into the page index it encodes.
fn parse_index(entry: &str) -> Result<u16> {
    Ok(entry.parse()?)
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

    // A minimal 1-page landscape PDF (MediaBox wider than tall). A height-capped
    // thumbnail render of this page exceeds the width cap, so it only stays within
    // THUMBNAIL_SIZE if create_thumbnail shrinks both dimensions.
    const LANDSCAPE_PAGE_PDF_DATA: &[u8] = b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count 1 /Kids [ 3 0 R ] >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] >> endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000057 00000 n\n0000000107 00000 n\ntrailer << /Size 4 /Root 1 0 R >> startxref\n157\n%%EOF\n";

    // Create a dummy PDF file for testing.
    // A 2-page PDF whose pages differ in size, so an index mix-up is visible.
    const TWO_PAGE_PDF_DATA: &[u8] = b"%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 2 /Kids [ 3 0 R 4 0 R ] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >> endobj
trailer << /Size 5 /Root 1 0 R >>
%%EOF
";

    /// Writes `data` into `dir` and opens it as a container.
    fn container_for(dir: &path::Path, filename: &str, data: &[u8]) -> (path::PathBuf, PdfContainer) {
        let filepath = dir.join(filename);
        File::create(&filepath).unwrap().write_all(data).unwrap();
        let container = PdfContainer::new(
            filepath.to_string_lossy().as_ref(),
            PdfRenderConfig::default(),
            Some(get_pdfium_lib_path()),
        )
        .expect("failed to open the PDF");
        (filepath, container)
    }

    /// Runs `body` on its own thread and fails if it has not finished within `secs`.
    ///
    /// The failure being guarded against is a *hang*, and a hanging test would block CI
    /// rather than report anything, so the deadline has to be the assertion.
    fn within_seconds(secs: u64, body: impl FnOnce() + Send + 'static) {
        let (done_tx, done_rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            body();
            let _ = done_tx.send(());
        });
        done_rx
            .recv_timeout(std::time::Duration::from_secs(secs))
            .expect("timed out: a second live Pdfium would hang here");
    }

    /// Serialises the tests in this module.
    ///
    /// They share one process-global worker whose document cache holds two entries, so
    /// tests running side by side evict each other's documents — which is invisible to
    /// most of them and fatal to the one that observes that cache.
    static PDF_TESTS: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn pdf_test_guard() -> std::sync::MutexGuard<'static, ()> {
        // A panicking test must not take the rest of the module down with it.
        PDF_TESTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn create_dummy_pdf(dir: &path::Path, filename: &str) -> path::PathBuf {
        let filepath = dir.join(filename);
        let mut file = File::create(&filepath).unwrap();
        file.write_all(SINGLE_PAGE_PDF_DATA).unwrap();
        filepath
    }

    #[test]
    fn test_new_valid_pdf() {
        let _guard = pdf_test_guard();
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
        let _guard = pdf_test_guard();
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
        let _guard = pdf_test_guard();
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
    fn pdf_reader_reads_renders_and_previews() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let container = PdfContainer::new(
            pdf_path.to_string_lossy().as_ref(),
            PdfRenderConfig::default(),
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let mut reader = container.open_reader().expect("failed to open a reader");

        // The page comes back as encoded bytes, like every other format's.
        let page = reader.read_page("0000").expect("read_page failed");
        assert!(crate::image::types::read_dimensions(&page).is_ok());

        // Measured from the MediaBox, so it costs no render at all.
        assert_eq!(
            reader.page_dimensions("0000").unwrap(),
            ImageDimensions {
                width: 612,
                height: 792
            }
        );

        // PDF is the one format that overrides read_preview, because pdfium renders
        // straight to the smaller size instead of shrinking a full page.
        let preview = reader
            .read_preview("0000")
            .expect("read_preview failed")
            .expect("PDF must offer a preview");
        let measured = crate::image::types::read_dimensions(&preview).unwrap();
        assert!(measured.width <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(measured.height <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(preview.len() < page.len());

        assert!(reader.read_page("9999").is_err());
        // Only one `Pdfium` may be alive in the process at a time.
        assert_eq!(container.max_readers(), 1);
    }

    #[test]
    fn test_get_image_dimensions_keeps_landscape_orientation() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let filepath = dir.path().join("landscape.pdf");
        File::create(&filepath)
            .unwrap()
            .write_all(LANDSCAPE_PAGE_PDF_DATA)
            .unwrap();

        let container = PdfContainer::new(
            filepath.to_string_lossy().as_ref(),
            PdfRenderConfig::default(),
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let measured = container
            .open_reader()
            .unwrap()
            .page_dimensions("0000")
            .expect("page_dimensions should succeed");

        // LANDSCAPE_PAGE_PDF_DATA declares MediaBox [0 0 792 612].
        assert!(measured.width > measured.height);
    }

    #[test]
    fn test_get_thumbnail_landscape_capped_both_dimensions() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let filepath = dir.path().join("landscape.pdf");
        File::create(&filepath)
            .unwrap()
            .write_all(LANDSCAPE_PAGE_PDF_DATA)
            .unwrap();

        let container = PdfContainer::new(
            filepath.to_string_lossy().as_ref(),
            PdfRenderConfig::default(),
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        // A landscape page rendered at target_height=THUMBNAIL_SIZE would be wider than
        // THUMBNAIL_SIZE; the preview must cap the width too (C4/C6).
        let preview = container
            .open_reader()
            .unwrap()
            .read_preview("0000")
            .unwrap()
            .expect("PDF offers a preview");
        let measured = crate::image::types::read_dimensions(&preview).unwrap();
        assert!(measured.width <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(measured.height <= crate::image::thumbnail::THUMBNAIL_SIZE);
    }

    #[test]
    fn two_pdfs_render_concurrently_without_hanging() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let (_, first) = container_for(dir.path(), "a.pdf", SINGLE_PAGE_PDF_DATA);
        let (_, second) = container_for(dir.path(), "b.pdf", LANDSCAPE_PAGE_PDF_DATA);

        // Two books rendering at once used to mean two live `Pdfium`s, and the second
        // one's drop unloaded the library out from under the first.
        within_seconds(30, move || {
            let left = std::thread::spawn(move || {
                let mut reader = first.open_reader().unwrap();
                for _ in 0..5 {
                    reader.read_page("0000").expect("first container failed");
                }
            });
            let right = std::thread::spawn(move || {
                let mut reader = second.open_reader().unwrap();
                for _ in 0..5 {
                    reader.read_page("0000").expect("second container failed");
                }
            });
            left.join().unwrap();
            right.join().unwrap();
        });
    }

    #[test]
    fn opening_a_pdf_while_another_is_being_read_does_not_hang() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let (_, open_book) = container_for(dir.path(), "open.pdf", SINGLE_PAGE_PDF_DATA);
        let mut reader = open_book.open_reader().unwrap();
        reader.read_page("0000").unwrap();

        // `PdfContainer::new` used to build a `Pdfium` and drop it at the end of the call,
        // which unloaded the library while this reader still held a document.
        let path = dir.path().to_path_buf();
        within_seconds(30, move || {
            let (_, other) = container_for(&path, "other.pdf", LANDSCAPE_PAGE_PDF_DATA);
            other
                .open_reader()
                .unwrap()
                .read_page("0000")
                .expect("the new container failed");
        });

        // The original reader is still usable: the library was never unloaded.
        assert!(!reader.read_page("0000").unwrap().is_empty());
    }

    #[test]
    fn the_worker_serves_every_page_of_a_multi_page_pdf() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let (_, container) = container_for(dir.path(), "two.pdf", TWO_PAGE_PDF_DATA);
        assert_eq!(container.get_entries(), &["0000".to_string(), "0001".to_string()]);

        let mut reader = container.open_reader().unwrap();

        // The two pages differ in size, so this also pins that the entry name is what
        // selects the page.
        assert_eq!(
            reader.page_dimensions("0000").unwrap(),
            ImageDimensions { width: 612, height: 792 }
        );
        assert_eq!(
            reader.page_dimensions("0001").unwrap(),
            ImageDimensions { width: 300, height: 400 }
        );

        for entry in ["0000", "0001"] {
            assert!(!reader.read_page(entry).unwrap().is_empty());
            assert!(!reader.read_preview(entry).unwrap().unwrap().is_empty());
        }
    }

    #[test]
    fn dropping_the_reader_closes_the_document() {
        let _guard = pdf_test_guard();
        let dir = tempdir().unwrap();
        let (filepath, container) = container_for(dir.path(), "closing.pdf", SINGLE_PAGE_PDF_DATA);
        let held = filepath.to_string_lossy().to_string();

        let mut reader = container.open_reader().unwrap();
        reader.read_page("0000").unwrap();

        let worker = crate::container::pdf_worker::worker(&None);
        assert!(
            worker.open_documents().unwrap().contains(&held),
            "reading a page must leave the document open"
        );

        drop(reader);
        drop(container);

        // `release` is a message; `open_documents` is a later one, and the worker serves
        // them in order, so its answer already reflects the release.
        assert!(
            !worker.open_documents().unwrap().contains(&held),
            "a closed book must not stay open in the worker"
        );
    }
}
