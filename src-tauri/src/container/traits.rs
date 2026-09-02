use crate::{
    error::Result,
    image::types::{read_dimensions, ImageDimensions},
};

#[cfg(test)]
use mockall::{automock, predicate::*};

/// File extensions (lowercase, without the dot) the container factory can open.
/// [`Container::is_supported_format`] and the factory's dispatch must both derive from
/// this list; a `factory.rs` test cross-checks that they stay in sync.
pub const SUPPORTED_EXTENSIONS: [&str; 6] = ["pdf", "rar", "zip", "epub", "cbz", "cbr"];

/// A book's identity and structure: what its pages are called, and how to open a reader
/// over them.
///
/// Immutable after construction, shared across threads, and it performs no I/O of its
/// own. Reading is [`PageReader`]'s job, and a reader belongs to one thread — which is
/// what leaves a format implementation with no concurrency decisions to make.
#[cfg_attr(test, automock)]
pub trait Container: Send + Sync + 'static {
    /// Returns a reference to a vector of entry names within the container.
    ///
    /// An entry names one page and is opaque to callers: image containers use the page's
    /// file name, PDF a zero-padded page number, EPUB a manifest id.
    ///
    /// Directory and archive containers list only the pages sitting *directly* inside the
    /// folder they opened, under the leaf file name — a page in `comic.zip/ch1` is listed
    /// as `001.jpg`, and pages in sub-folders belong to their own container.
    fn get_entries(&self) -> &Vec<String>;

    /// Checks whether the container corresponds to a directory on the filesystem.
    ///
    /// # Returns
    ///
    /// Returns `true` if the container is a directory, `false` otherwise (e.g., it's a file).
    fn is_directory(&self) -> bool;

    /// Returns whether this container is a novel (text-based).
    fn is_novel(&self) -> bool {
        false
    }

    /// How many readers may usefully exist at once.
    ///
    /// `1` means the backend is exclusive (only one handle may be open) or sequential
    /// (extra handles would each redo the same forward scan). Anything larger is a hint,
    /// not a demand: the caller also bounds the count by the machine's parallelism.
    fn max_readers(&self) -> usize {
        usize::MAX
    }

    /// Opens an independent reader over this container's pages.
    ///
    /// Called on the thread that will use the reader, so the returned value never crosses
    /// a thread boundary and need not be `Send`. That is what lets a format hold a native
    /// handle, a cursor, or any other state it could not otherwise share.
    ///
    /// # Returns
    ///
    /// A `Result` containing a new reader positioned at no particular entry.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the underlying file cannot be opened.
    fn open_reader(&self) -> Result<Box<dyn PageReader>>;
}

/// Reads the pages of one container. Owned by exactly one thread for its whole life.
///
/// A reader may hold non-`Send` state and may keep a cursor between calls, because
/// nothing else can reach it. Requests within one priority class arrive in ascending
/// entry order, so a sequential format only ever has to move its cursor forward.
///
/// Every method yields *encoded* bytes, exactly as the format stores or renders them.
/// Decoding and resizing belong to the caller, so a reader never has to know what the
/// image will be used for.
#[cfg_attr(test, automock)]
pub trait PageReader {
    /// Reads one page's encoded bytes.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name, as it appears in [`Container::get_entries`].
    ///
    /// # Returns
    ///
    /// The page's bytes, undecoded and unresized.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry is not part of this container or cannot be read.
    fn read_page(&mut self, entry: &str) -> Result<Vec<u8>>;

    /// Reads one page's pixel dimensions.
    ///
    /// Correct but slow by default — it reads the whole page. A format that can reach an
    /// image header without decompressing the rest overrides this.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name to measure.
    ///
    /// # Returns
    ///
    /// The page's dimensions in pixels.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry cannot be read or is not a supported image.
    fn page_dimensions(&mut self, entry: &str) -> Result<ImageDimensions> {
        Ok(read_dimensions(&self.read_page(entry)?)?)
    }

    /// Reads the encoded bytes of a small stand-in for the page, if the format can produce
    /// one *more cheaply* than [`PageReader::read_page`].
    ///
    /// `None` — the default — means no such shortcut exists, which is the honest answer
    /// for every image container: their pages are already stored encoded, so a preview
    /// costs a full read plus a decode, a resize and a re-encode. Only a format that
    /// renders its pages (PDF) can render a smaller one instead.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name to preview.
    ///
    /// # Returns
    ///
    /// `Ok(Some(bytes))` when the format has a cheaper path, `Ok(None)` when it does not.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry exists but its preview cannot be produced.
    fn read_preview(&mut self, _entry: &str) -> Result<Option<Vec<u8>>> {
        Ok(None)
    }
}

impl dyn Container {
    /// Checks if a given filename has a supported container file extension.
    ///
    /// The check is case-insensitive. Supported formats include "pdf", "rar", "zip", "epub",
    /// "cbz" (a ZIP comic archive), and "cbr" (a RAR comic archive).
    ///
    /// # Arguments
    ///
    /// * `filename` - The filename to check.
    ///
    /// # Returns
    ///
    /// Returns `true` if the filename ends with a supported extension, `false` otherwise.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        SUPPORTED_EXTENSIONS
            .iter()
            .any(|ext| lowercase_name.ends_with(&format!(".{ext}")))
    }
}

#[cfg(test)]
mod tests {
    use rstest::*;

    use super::*;

    #[rstest]
    #[case("document.pdf", true)]
    #[case("document.PDF", true)]
    #[case("archive.rar", true)]
    #[case("archive.RAR", true)]
    #[case("compressed.zip", true)]
    #[case("compressed.ZIP", true)]
    #[case("comic.cbz", true)]
    #[case("comic.CBZ", true)]
    #[case("comic.cbr", true)]
    #[case("comic.CBR", true)]
    #[case("test.pdf.rar", true)]
    #[case(".pdf", true)]
    #[case(".rar", true)]
    #[case(".zip", true)]
    #[case("file.txt", false)]
    #[case("file.jpg", false)]
    #[case("file.png", false)]
    #[case("file.pdf_test", false)]
    #[case("file.rar.test", false)]
    #[case("document", false)]
    #[case("", false)]
    fn test_container_is_supported_format(#[case] filename: &str, #[case] expected: bool) {
        assert_eq!(
            expected,
            <dyn Container>::is_supported_format(filename),
            "Failed for filename: {}",
            filename
        );
    }
}
