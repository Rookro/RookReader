//! The one place in the process that owns a `Pdfium`.
//!
//! `Drop for Pdfium` calls `FPDF_DestroyLibrary()`, which unloads the library out from
//! under any other live instance — two of them hang the process. Binding the library is
//! therefore not something a container may do for itself: every PDF operation is a
//! message to a single thread that owns the one instance and never drops it.
//!
//! That thread also keeps the documents it has loaded, which is what a `PdfContainer`
//! cannot do: a `PdfDocument<'a>` borrows the `Pdfium` that produced it, so the two can
//! only live together as locals of one function. Here they are exactly that.

use std::{
    sync::{mpsc, Arc, Mutex, OnceLock},
    thread,
};

use image::codecs::jpeg::JpegEncoder;
use pdfium_render::prelude::{PdfDocument, PdfRenderConfig, Pdfium};

use crate::{
    error::{Error, Result},
    image::{
        resizer::{shrink_to_fit, ResizeFilter},
        thumbnail::THUMBNAIL_SIZE,
        types::{Image, ImageDimensions},
    },
    perf,
    perf::Span,
};

/// How many documents the worker keeps open: the book being read, plus the one-shot a
/// bookshelf thumbnail asks for. A third would evict the open book on every thumbnail.
const MAX_OPEN_DOCUMENTS: usize = 2;

static WORKER: OnceLock<Worker> = OnceLock::new();

/// Returns the process-wide PDF worker, starting it on first use.
///
/// `library_path` is read only by the call that starts the worker. A `Pdfium` cannot be
/// replaced while the process runs — replacing it means dropping the old one, which
/// unloads the library — so a later change to the setting takes effect at the next app
/// start rather than the next book.
pub(crate) fn worker(library_path: &Option<String>) -> &'static Worker {
    WORKER.get_or_init(|| Worker::start(library_path.clone()))
}

/// A handle on the worker thread. There is exactly one, reached through `&'static`.
pub(crate) struct Worker {
    /// Guarded because `mpsc::Sender` is not `Sync`, and this handle is shared by every
    /// thread that reads a PDF. The lock is held only for the send.
    tx: Mutex<mpsc::Sender<Request>>,
}

/// Work the worker performs against one document, with the channel to answer on.
enum Request {
    PageCount {
        path: String,
        reply: mpsc::Sender<Result<usize>>,
    },
    Page {
        path: String,
        index: u16,
        config: Arc<PdfRenderConfig>,
        reply: mpsc::Sender<Result<Image>>,
    },
    Dimensions {
        path: String,
        index: u16,
        reply: mpsc::Sender<Result<ImageDimensions>>,
    },
    Preview {
        path: String,
        index: u16,
        config: Arc<PdfRenderConfig>,
        reply: mpsc::Sender<Result<Image>>,
    },
    /// Closes a document the caller has finished with. Without it the worker holds a
    /// closed book's parsed structures and its file handle until two *other* PDFs displace
    /// it, so a reader who opens one large PDF and moves on keeps paying for it.
    Release { path: String },
    /// Reports which documents are currently open, so a test can observe a release.
    #[cfg(test)]
    OpenDocuments {
        reply: mpsc::Sender<Result<Vec<String>>>,
    },
}

impl Worker {
    /// Spawns the worker thread. Binding the library happens on that thread, so a failure
    /// there ends it and every later request reports [`unavailable`] rather than hanging.
    fn start(library_path: Option<String>) -> Self {
        let (tx, rx) = mpsc::channel();
        thread::Builder::new()
            .name("pdfium-worker".to_string())
            .spawn(move || run(rx, library_path))
            .expect("failed to spawn the pdfium worker thread");
        Self { tx: Mutex::new(tx) }
    }

    /// The document's page count.
    pub(crate) fn page_count(&self, path: &str) -> Result<usize> {
        self.ask(|reply| Request::PageCount {
            path: path.to_string(),
            reply,
        })
    }

    /// Renders one page at `config`'s resolution, as a JPEG.
    pub(crate) fn render_page(
        &self,
        path: &str,
        index: u16,
        config: Arc<PdfRenderConfig>,
    ) -> Result<Image> {
        self.ask(|reply| Request::Page {
            path: path.to_string(),
            index,
            config,
            reply,
        })
    }

    /// One page's size, read from the page itself rather than from a render.
    pub(crate) fn page_dimensions(&self, path: &str, index: u16) -> Result<ImageDimensions> {
        self.ask(|reply| Request::Dimensions {
            path: path.to_string(),
            index,
            reply,
        })
    }

    /// Renders one page at thumbnail size, or returns the thumbnail the document carries.
    pub(crate) fn render_thumbnail(
        &self,
        path: &str,
        index: u16,
        config: Arc<PdfRenderConfig>,
    ) -> Result<Image> {
        self.ask(|reply| Request::Preview {
            path: path.to_string(),
            index,
            config,
            reply,
        })
    }

    /// Tells the worker nothing needs this document any more.
    ///
    /// Best-effort: a caller that is going away cannot do anything about a dead worker,
    /// and a document left open is reclaimed by the cache bound anyway.
    pub(crate) fn release(&self, path: &str) {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(Request::Release {
                path: path.to_string(),
            });
        }
    }

    /// The paths the worker currently holds open, oldest first.
    #[cfg(test)]
    pub(crate) fn open_documents(&self) -> Result<Vec<String>> {
        self.ask(|reply| Request::OpenDocuments { reply })
    }

    /// Sends one request and blocks for its answer.
    fn ask<T>(&self, make: impl FnOnce(mpsc::Sender<Result<T>>) -> Request) -> Result<T> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.tx
            .lock()
            .map_err(|_| unavailable())?
            .send(make(reply_tx))
            .map_err(|_| unavailable())?;
        reply_rx.recv().map_err(|_| unavailable())?
    }
}

/// The error every request gets once the worker thread is gone. The `OnceLock` cannot be
/// re-initialised, so this is permanent for the life of the process.
fn unavailable() -> Error {
    Error::Other("PDF support is unavailable: the pdfium library could not be loaded".to_string())
}

/// The worker thread's whole life: bind the library once, then serve requests against
/// documents kept open beside it.
fn run(rx: mpsc::Receiver<Request>, library_path: Option<String>) {
    let pdfium = match get_pdfium(&library_path) {
        Ok(pdfium) => pdfium,
        Err(e) => {
            log::error!("Failed to bind the pdfium library: {e}");
            return;
        }
    };

    // Declared after `pdfium` so it is dropped before it: every document borrows it.
    let mut docs: Vec<(String, PdfDocument<'_>)> = Vec::new();

    while let Ok(request) = rx.recv() {
        match request {
            Request::Release { path } => {
                docs.retain(|(open, _)| open != &path);
            }
            #[cfg(test)]
            Request::OpenDocuments { reply } => {
                let _ = reply.send(Ok(docs.iter().map(|(open, _)| open.clone()).collect()));
            }
            Request::PageCount { path, reply } => {
                let result =
                    document(&pdfium, &mut docs, &path).map(|doc| doc.pages().len() as usize);
                let _ = reply.send(result);
            }
            Request::Page {
                path,
                index,
                config,
                reply,
            } => {
                // A PDF page is the most expensive read in the app and it is two costs in
                // one: parsing the document behind the page, and rendering the page.
                // Splitting them is what says which of the two a slow page was.
                let span = Span::start();
                // `document` below is what would say this, but it takes `docs` mutably —
                // so ask first, and only when someone is listening.
                let doc = if !span.active() {
                    ""
                } else if docs.iter().any(|(open, _)| open == &path) {
                    "hit"
                } else {
                    "load"
                };
                let loading = Span::start();
                let document = document(&pdfium, &mut docs, &path);
                let load_ms = loading.ms().unwrap_or_default();

                let rendering = Span::start();
                let result = document.and_then(|doc| render_page(doc, &config, index));
                let render_ms = rendering.ms().unwrap_or_default();

                perf!(
                    span,
                    "pdf",
                    "page={index} doc={doc} load_ms={load_ms:.2} render_ms={render_ms:.2}"
                );
                let _ = reply.send(result);
            }
            Request::Dimensions { path, index, reply } => {
                let result =
                    document(&pdfium, &mut docs, &path).and_then(|doc| page_size(doc, index));
                let _ = reply.send(result);
            }
            Request::Preview {
                path,
                index,
                config,
                reply,
            } => {
                let result = document(&pdfium, &mut docs, &path)
                    .and_then(|doc| render_thumbnail(doc, &config, index));
                let _ = reply.send(result);
            }
        }
    }
}

/// Returns the open document for `path`, loading it if the worker does not hold it.
///
/// `docs` is held least-recently-used: a hit moves to the back, and eviction takes the
/// front. With room for two, the pattern that matters is "the book being read plus a
/// passer-by", and the book being read is the one asked for constantly — so it is never
/// the least recent, and a run of bookshelf thumbnails displaces each other rather than
/// it. Evicting by age instead would throw the open book out on the second thumbnail.
fn document<'p, 'd>(
    pdfium: &'p Pdfium,
    docs: &'d mut Vec<(String, PdfDocument<'p>)>,
    path: &str,
) -> Result<&'d PdfDocument<'p>> {
    match docs.iter().position(|(open, _)| open == path) {
        Some(index) => {
            let hit = docs.remove(index);
            docs.push(hit);
        }
        None => {
            if docs.len() >= MAX_OPEN_DOCUMENTS {
                docs.remove(0);
            }
            let document = pdfium.load_pdf_from_file(path, None)?;
            docs.push((path.to_string(), document));
        }
    }

    Ok(&docs[docs.len() - 1].1)
}

/// Renders a PDF page to a JPEG using a specific config.
fn render_page(pdf: &PdfDocument, render_config: &PdfRenderConfig, index: u16) -> Result<Image> {
    let page = pdf.pages().get(index).map_err(Error::from)?;
    let img = page.render_with_config(render_config)?.as_image();

    let mut buffer = Vec::new();
    JpegEncoder::new_with_quality(&mut buffer, 80).encode_image(&img)?;

    Ok(Image {
        data: buffer,
        width: img.width(),
        height: img.height(),
    })
}

/// Reads a PDF page's size, in points rounded to whole pixels.
///
/// The page is not rendered: rendering scales the page to the configured target height
/// while preserving its aspect ratio, so the points already carry the orientation and
/// ratio the caller needs.
fn page_size(pdf: &PdfDocument, index: u16) -> Result<ImageDimensions> {
    let page = pdf.pages().get(index).map_err(Error::from)?;

    Ok(ImageDimensions {
        width: page.width().value.round().max(1.0) as u32,
        height: page.height().value.round().max(1.0) as u32,
    })
}

/// Renders a PDF page to a thumbnail-sized JPEG.
///
/// PDF is the one format where this is *cheaper* than reading the page: pdfium renders
/// straight to the smaller size, or hands back a thumbnail the document already carries,
/// instead of decoding a full page and shrinking it.
fn render_thumbnail(
    pdf: &PdfDocument,
    render_config: &PdfRenderConfig,
    index: u16,
) -> Result<Image> {
    let page = pdf.pages().get(index).map_err(Error::from)?;
    let img = match page.embedded_thumbnail() {
        Ok(thumbnail) => thumbnail.as_image(),
        Err(_) => page.render_with_config(render_config)?.as_image(),
    };
    // Cap both dimensions to the thumbnail contract: embedded thumbnails have no
    // spec-mandated size, and the render config constrains height only (a landscape
    // page still exceeds the width cap). Other containers already uphold this.
    let img = shrink_to_fit(&img, THUMBNAIL_SIZE, THUMBNAIL_SIZE, ResizeFilter::Bilinear)?;

    let mut buffer = Vec::new();
    // Use a lower quality for thumbnails to make them smaller and faster to encode.
    JpegEncoder::new_with_quality(&mut buffer, 10).encode_image(&img)?;

    Ok(Image {
        data: buffer,
        width: img.width(),
        height: img.height(),
    })
}

/// Binds the `pdfium` library. The only call site is [`run`], on the worker thread.
fn get_pdfium(library_path: &Option<String>) -> Result<Pdfium> {
    if let Some(lib_path) = library_path {
        let lib_name = Pdfium::pdfium_platform_library_name_at_path(lib_path);
        let bindings = Pdfium::bind_to_library(lib_name)?;
        Ok(Pdfium::new(bindings))
    } else {
        Ok(Pdfium::default())
    }
}
