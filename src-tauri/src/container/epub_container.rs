use std::{collections::HashMap, path::Path, sync::Arc};

use rbook::{
    prelude::{Manifest, ManifestEntry, MetaEntry, Metadata},
    reader::{Reader, ReaderContent},
    Ebook, Epub,
};
use scraper::{Html, Selector};

use crate::{
    container::{container::Container, image::Image},
    error::{Error, Result},
};

/// A container for EPUB.
pub struct EpubContainer {
    /// The file path of the container.
    path: String,
    /// The entries in the container.
    entries: Vec<String>,
}

impl Container for EpubContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &String) -> Result<Arc<Image>> {
        let mut epub = Epub::options().strict(false).open(&self.path)?;
        let image = load_image(&mut epub, entry)?;
        Ok(image)
    }

    fn is_directory(&self) -> bool {
        false
    }
}

impl EpubContainer {
    /// Creates a EPUB container from the specified path.
    ///
    /// * `path` - The path to the archive container.
    pub fn new(path: &String) -> Result<Self> {
        let mut epub = Epub::options().strict(false).open(&path)?;
        let mut entries: Vec<String> = epub
            .manifest()
            .images()
            .filter_map(|manifest| {
                if manifest.resource_kind().is_image() {
                    if let Some(key) = manifest.key() {
                        Some(key.to_string())
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        if let Some(order_map) = create_image_order_map(&mut epub) {
            entries.sort_by_key(|id| *order_map.get(id).unwrap_or(&usize::MAX));
        } else {
            entries.sort_by(|a, b| natord::compare_ignore_case(a, b));
        }

        Ok(Self {
            path: path.clone(),
            entries,
        })
    }

    /// Checks if the EPUB is a novel.
    ///
    /// Note: This function is currently in beta and may be subject to breaking changes
    /// in future releases.
    ///
    /// Returns `true` if the "rendition:layout" is not "pre-paginated", `false` otherwise.
    pub fn is_novel(&self) -> bool {
        let Ok(epub) = Epub::options().strict(false).open(&self.path) else {
            return false;
        };
        let Some(layout) = epub.metadata().entries().find_map(|meta| {
            if meta.property().as_str() == "rendition:layout" {
                Some(meta.value().to_string())
            } else {
                None
            }
        }) else {
            return true;
        };
        return layout != "pre-paginated";
    }
}

/// Loads an image from the specified entry name.
///
/// * `epub` - The EPUB instance.
/// * `entry` - The entry name of the image to get.
fn load_image(epub: &mut Epub, entry: &String) -> Result<Arc<Image>> {
    let Some(resource) = epub
        .manifest()
        .images()
        .find(|image| image.key().unwrap_or_default() == entry)
    else {
        return Err(Error::EntryNotFound(format!(
            "[EPUB] Resource not found: {}",
            entry
        )));
    };

    let image = Image::new(resource.read_bytes()?)?;
    Ok(Arc::new(image))
}

/// Create a map of image IDs to their order in the EPUB.
///
/// Returns a HashMap where the key is the image ID and the value is the order in the EPUB if the map is created successfully,
/// otherwise None.
///
/// * epub - The EPUB instance to create the map for.
fn create_image_order_map(epub: &mut Epub) -> Option<HashMap<String, usize>> {
    let mut map = HashMap::new();
    let mut current_order = 0;

    let mut reader = epub.reader();
    while let Some(Ok(page)) = reader.read_next() {
        let chapter_dir = match page.manifest_entry().key() {
            Some(resource_path_in_epub) => Path::new(resource_path_in_epub)
                .parent()
                .unwrap_or(Path::new("")),
            None => Path::new(""),
        };

        let Ok(content) = page.manifest_entry().read_str() else {
            continue;
        };
        let document = Html::parse_document(&content);
        let selector = Selector::parse("img, image").unwrap();
        for element in document.select(&selector) {
            let src_attr = element
                .value()
                .attr("src")
                .or_else(|| element.value().attr("xlink:href"))
                .or_else(|| element.value().attr("href"));

            if let Some(src) = src_attr {
                let resolved_path = chapter_dir.join(src);
                if let Some(resource_id) = find_resource_id_by_path(epub, &resolved_path) {
                    map.entry(resource_id).or_insert_with(|| {
                        let order = current_order;
                        current_order += 1;
                        order
                    });
                }
            }
        }
    }
    if map.is_empty() {
        None
    } else {
        Some(map)
    }
}

/// Find the resource ID by its path within the EPUB.
///
/// Returns the resource ID if found, otherwise None.
///
/// * `epub`: The EPUB instance to search within.
/// * `target_path`: The path of the resource to find.
fn find_resource_id_by_path(epub: &Epub, target_path: &Path) -> Option<String> {
    epub.manifest().images().find_map(|image| {
        let Some(image_key) = image.key() else {
            return None;
        };

        let image_path = Path::new(image_key);
        if target_path == image_path || target_path.file_name() == image_path.file_name() {
            Some(image_key.to_string())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Write, path};

    use tempfile::tempdir;
    use zip::{write::FileOptions, ZipWriter};

    use super::*;

    // A valid 1x1 transparent PNG
    const DUMMY_PNG_DATA: &[u8] = &[
        // Header: Magic Number
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // Chunk: IHDR (Image Header)
        0x00, 0x00, 0x00, 0x0D, // Length
        0x49, 0x48, 0x44, 0x52, // Type (IHDR)
        0x00, 0x00, 0x00, 0x01, // Width: 1
        0x00, 0x00, 0x00, 0x01, // Height: 1
        0x08, 0x06, 0x00, 0x00, 0x00, // Bit Depth, Color Type, etc.
        0x1F, 0x15, 0xC4, 0x89, // CRC
        // Chunk: IDAT (Image Data)
        0x00, 0x00, 0x00, 0x0A, // Length
        0x49, 0x44, 0x41, 0x54, // Type (IDAT)
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Raw zlib data
        0x0D, 0x0A, 0x2D, 0xB4, // CRC (Correct for this data)
        // Chunk: IEND (End of Image)
        0x00, 0x00, 0x00, 0x00, // Length
        0x49, 0x45, 0x4E, 0x44, // Type (IEND)
        0xAE, 0x42, 0x60, 0x82, // CRC
    ];

    const CONTAINER_XML: &str = r#"<?xml version="1.0"?>
                                <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                                <rootfiles>
                                    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
                                </rootfiles>
                                </container>"#;

    fn content_opf(with_images: bool) -> String {
        let manifest_items = if with_images {
            r#"<item id="image1" href="images/image1.png" media-type="image/png"/>
            <item id="cover" href="images/cover.png" media-type="image/png"/>
            <item id="non-image" href="data.txt" media-type="text/plain"/>"#
        } else {
            r#"<item id="non-image" href="data.txt" media-type="text/plain"/>"#
        };

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
            <package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
            <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                <dc:title>Test Book</dc:title>
                <dc:identifier id="bookid">urn:uuid:12345</dc:identifier>
                <dc:language>en</dc:language>
            </metadata>
            <manifest>
                <item id="chapter1" href="text/chapter1.xhtml" media-type="application/xhtml+xml"/>
                {}
            </manifest>
            <spine toc="ncx">
                <itemref idref="chapter1"/>
            </spine>
            </package>"#,
            manifest_items
        )
    }

    fn chapter1_xhtml(with_images: bool) -> String {
        let images = if with_images {
            r#"<img src="../images/image1.png" />"#
        } else {
            ""
        };

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
                {}
            </body>
            </html>"#,
            images
        )
    }

    /// Helper function to create a dummy EPUB file.
    fn create_dummy_epub(
        dir: &path::Path,
        filename: &str,
        files: &[(&str, &[u8])],
    ) -> path::PathBuf {
        let zip_filepath = dir.join(filename);
        let file = File::create(&zip_filepath).expect("failed to create zip file");
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::<()>::default()
            .compression_method(zip::CompressionMethod::STORE)
            .unix_permissions(0o755);

        for (entry_name, content) in files {
            zip.start_file(*entry_name, options)
                .unwrap_or_else(|_| panic!("failed to start zip entry: {}", entry_name));
            zip.write_all(content)
                .expect("failed to write zip entry content");
        }
        zip.finish().expect("failed to finish zip file");
        zip_filepath
    }

    #[test]
    fn test_new_valid_epub() {
        let dir = tempdir().expect("failed to create tempdir");
        let content_opf_str = content_opf(true);
        let chapter1_xhtml_str = chapter1_xhtml(true);

        let epub_path = create_dummy_epub(
            dir.path(),
            "test.epub",
            &[
                ("mimetype", b"application/epub+zip"),
                ("META-INF/container.xml", CONTAINER_XML.as_bytes()),
                ("OEBPS/content.opf", content_opf_str.as_bytes()),
                ("OEBPS/text/chapter1.xhtml", chapter1_xhtml_str.as_bytes()),
                ("OEBPS/images/image1.png", DUMMY_PNG_DATA),
                ("OEBPS/images/cover.png", DUMMY_PNG_DATA),
                ("OEBPS/data.txt", b"some text data"),
            ],
        );

        let container = EpubContainer::new(&epub_path.to_string_lossy().to_string())
            .expect("failed to create EpubContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "cover");
        assert_eq!(container.entries[1], "image1");
    }

    #[test]
    fn test_new_epub_no_images_in_spine() {
        let dir = tempdir().expect("failed to create tempdir");
        let content_opf_str = content_opf(true);
        let chapter1_xhtml_str = chapter1_xhtml(false); // No images in chapter

        let epub_path = create_dummy_epub(
            dir.path(),
            "test.epub",
            &[
                ("mimetype", b"application/epub+zip"),
                ("META-INF/container.xml", CONTAINER_XML.as_bytes()),
                ("OEBPS/content.opf", content_opf_str.as_bytes()),
                ("OEBPS/text/chapter1.xhtml", chapter1_xhtml_str.as_bytes()),
                ("OEBPS/images/image1.png", DUMMY_PNG_DATA),
                ("OEBPS/images/cover.png", DUMMY_PNG_DATA),
                ("OEBPS/data.txt", b"some text data"),
            ],
        );

        let container = EpubContainer::new(&epub_path.to_string_lossy().to_string())
            .expect("failed to create EpubContainer");

        assert_eq!(container.entries.len(), 2);
        assert!(container.entries.contains(&"image1".to_string()));
        assert!(container.entries.contains(&"cover".to_string()));
    }

    #[test]
    fn test_new_empty_epub() {
        let dir = tempdir().expect("failed to create tempdir");
        let content_opf_str = content_opf(false); // No images in manifest
        let chapter1_xhtml_str = chapter1_xhtml(false);

        let epub_path = create_dummy_epub(
            dir.path(),
            "empty.epub",
            &[
                ("mimetype", b"application/epub+zip"),
                ("META-INF/container.xml", CONTAINER_XML.as_bytes()),
                ("OEBPS/content.opf", content_opf_str.as_bytes()),
                ("OEBPS/text/chapter1.xhtml", chapter1_xhtml_str.as_bytes()),
                ("OEBPS/data.txt", b"some text data"),
            ],
        );

        let container = EpubContainer::new(&epub_path.to_string_lossy().to_string())
            .expect("failed to create EpubContainer");
        assert!(container.entries.is_empty());
    }

    #[test]
    fn test_new_non_existent_epub() {
        let non_existent_path = String::from("/non/existent/file.epub");
        let container = EpubContainer::new(&non_existent_path);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().expect("failed to create tempdir");
        let content_opf_str = content_opf(true);
        let chapter1_xhtml_str = chapter1_xhtml(true);

        let epub_path = create_dummy_epub(
            dir.path(),
            "test.epub",
            &[
                ("mimetype", b"application/epub+zip"),
                ("META-INF/container.xml", CONTAINER_XML.as_bytes()),
                ("OEBPS/content.opf", content_opf_str.as_bytes()),
                ("OEBPS/text/chapter1.xhtml", chapter1_xhtml_str.as_bytes()),
                ("OEBPS/images/image1.png", DUMMY_PNG_DATA),
                ("OEBPS/images/cover.png", DUMMY_PNG_DATA),
            ],
        );

        let container = EpubContainer::new(&epub_path.to_string_lossy().to_string()).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0], "cover");
        assert_eq!(entries[1], "image1");
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let content_opf_str = content_opf(true);
        let chapter1_xhtml_str = chapter1_xhtml(true);

        let epub_path = create_dummy_epub(
            dir.path(),
            "test.epub",
            &[
                ("mimetype", b"application/epub+zip"),
                ("META-INF/container.xml", CONTAINER_XML.as_bytes()),
                ("OEBPS/content.opf", content_opf_str.as_bytes()),
                ("OEBPS/text/chapter1.xhtml", chapter1_xhtml_str.as_bytes()),
                ("OEBPS/images/image1.png", DUMMY_PNG_DATA),
                ("OEBPS/images/cover.png", DUMMY_PNG_DATA),
            ],
        );
        let container = EpubContainer::new(&epub_path.to_string_lossy().to_string())
            .expect("failed to create EpubContainer");

        let image = container
            .get_image(&String::from("image1"))
            .expect("get_image should succeed for existing image");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, DUMMY_PNG_DATA);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let content_opf_str = content_opf(true);
        let chapter1_xhtml_str = chapter1_xhtml(true);
        let epub_path = create_dummy_epub(
            dir.path(),
            "test.epub",
            &[
                ("mimetype", b"application/epub+zip"),
                ("META-INF/container.xml", CONTAINER_XML.as_bytes()),
                ("OEBPS/content.opf", content_opf_str.as_bytes()),
                ("OEBPS/text/chapter1.xhtml", chapter1_xhtml_str.as_bytes()),
                ("OEBPS/images/image1.png", DUMMY_PNG_DATA),
            ],
        );
        let container = EpubContainer::new(&epub_path.to_string_lossy().to_string()).unwrap();
        let result = container.get_image(&String::from("non_existent_image"));
        assert!(result.is_err());
    }
}
