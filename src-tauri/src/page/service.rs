//! One scheduler for one open book: every reader thread and the queue they take from.
//!
//! A format decides how to read a page; it does not decide when, in what order, or on how
//! many threads. Those are decided here, once, for every format — which is what keeps a
//! new format from having to choose between locking a shared handle and rebuilding one
//! per call.

use std::{
    cmp::{max, min, Ordering},
    collections::{hash_map::Entry, BinaryHeap, HashMap},
    sync::{mpsc, Arc, Condvar, Mutex, MutexGuard, RwLock},
    thread,
};

use tokio::sync::oneshot;

use crate::{
    container::traits::{Container, PageReader},
    error::{Error, Result},
    image::{
        resizer::ResizeFilter,
        types::{Image, ImageDimensions},
    },
    page::{
        cache::Cache,
        pipeline::{Fit, Pipeline, Rendered},
    },
    perf,
    perf::Span,
};

/// Job classes, most urgent first. Ties are broken by ascending entry index so a
/// sequential reader can serve a whole class in one forward pass.
///
/// The preload window is split at the current page rather than sorted by distance from
/// it: the reading direction still comes first, but each class stays a single forward
/// pass, so a cursor reader rewinds at most once per window instead of once per job.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Priority {
    /// A page the reader is waiting to see.
    Foreground,
    /// The pages after the one the reader asked for.
    PreloadAhead,
    /// The pages before the current one.
    PreloadBehind,
    /// Measuring every page of the book.
    Scan,
}

impl Priority {
    /// Whether this class is preload, which is queued apart and bounded by the reserve.
    fn is_preload(self) -> bool {
        matches!(self, Priority::PreloadAhead | Priority::PreloadBehind)
    }
}

/// One page read's identity: the entry, and the box it is being rendered into.
type ReadKey = (String, Fit);

/// Everyone waiting on a single page read.
type Waiters = Vec<oneshot::Sender<Result<Arc<Image>>>>;

/// The answer to one preview request, and the caller's end of it.
type PreviewReply = oneshot::Sender<Result<Option<Arc<Image>>>>;
type PreviewRx = oneshot::Receiver<Result<Option<Arc<Image>>>>;

/// Where a finished job's result goes.
enum Reply {
    Page(oneshot::Sender<Result<Arc<Image>>>),
    /// One sender shared by a whole scan. The index rides along because replies arrive in
    /// completion order and [`PageService::dimensions`] has to return them in entry order.
    Dimensions(usize, mpsc::Sender<(usize, Result<ImageDimensions>)>),
    Preview(PreviewReply),
    /// Preload: the result only has to reach the cache.
    None,
}

/// A page read after it has been enqueued: answered from the cache, or waiting on a worker.
enum Fetch {
    Cached(Arc<Image>),
    Queued {
        rx: oneshot::Receiver<Result<Arc<Image>>>,
        /// What the wait is spent on, `"read"` or `"inflight"`, for the perf record.
        source: &'static str,
        /// How many jobs were queued ahead of it.
        queued: usize,
    },
}

/// One page of work.
struct Job {
    priority: Priority,
    /// `(entry index, 0 for a preview and 1 for a page)`. The second element only matters
    /// where renders queue behind each other, as a PDF's do on its one pdfium thread:
    /// serving a page's cheap preview before its full render is what puts something on
    /// screen early.
    order: (usize, u8),
    entry: String,
    /// The box this page is to be rendered into, taken when the job was made.
    ///
    /// Carried rather than read from the pipeline at run time so a viewport change
    /// mid-read cannot hand the callers waiting on this box a page fitted to another.
    /// Unused by the jobs that do not read a page.
    fit: Fit,
    /// The reader's display generation, if this job belongs to one. A newer generation
    /// cancels queued jobs with a smaller number; `None` jobs (loupe, preload, scan) are
    /// never cancelled by a generation advance.
    generation: Option<u64>,
    reply: Reply,
}

impl Job {
    /// Whether this job reads the page itself, and so may be shared with another caller
    /// asking for the same entry.
    fn reads_the_page(&self) -> bool {
        matches!(self.reply, Reply::Page(_) | Reply::None)
    }

    /// The key both `Ord` and `Eq` are written against.
    fn key(&self) -> (Priority, (usize, u8)) {
        (self.priority, self.order)
    }

    /// Takes the reply out, leaving the job with nobody to answer.
    fn take_reply(&mut self) -> Reply {
        std::mem::replace(&mut self.reply, Reply::None)
    }
}

// `PartialEq`, `Eq`, `PartialOrd` and `Ord` are all written out by hand against the same
// key. None can be derived: `Reply` holds channel senders, which are neither comparable
// nor `Eq`.
impl PartialEq for Job {
    fn eq(&self, other: &Self) -> bool {
        self.key() == other.key()
    }
}

impl Eq for Job {}

impl PartialOrd for Job {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// `BinaryHeap` is a max-heap, so the order is reversed: the smallest
/// `(priority, order)` must compare greatest.
impl Ord for Job {
    fn cmp(&self, other: &Self) -> Ordering {
        other.key().cmp(&self.key())
    }
}

/// The queue itself, plus what is needed to keep two workers off the same page.
struct Queue {
    /// The jobs a worker may always take: foreground, preview, and the scan.
    jobs: BinaryHeap<Job>,
    /// Preload, held in its own heap.
    ///
    /// Not a priority band inside `jobs`: preload outranks the scan, so a worker the
    /// reserve keeps out of preload would peek a job it may not take and park, with the
    /// scan below it unread. Two heaps let that worker look straight past preload.
    preload: BinaryHeap<Job>,
    /// Entries a worker is currently reading, and the callers waiting on each. A request
    /// for a page another worker has already picked up attaches here instead of reading
    /// it a second time.
    ///
    /// Keyed by entry *and* fit: the same page at two different boxes is two different
    /// reads, and joining them would hand one caller the other's pixels.
    in_flight: HashMap<ReadKey, Waiters>,
    /// How many workers are inside a preload job right now.
    ///
    /// Preload may not take the last [`Shared::reserve`] workers, so a page the reader
    /// asks for always finds one free. Counted rather than dedicated because which worker
    /// is idle does not matter, only that one is.
    preloading: usize,
    /// How many reader threads are still running.
    ///
    /// Once this reaches zero the queue has no consumer, so the jobs it holds would be
    /// waited on forever rather than fail. [`worker_left`] is where that is noticed.
    live: usize,
    /// The newest display generation admitted so far; `0` before any numbered request.
    latest_generation: u64,
    closed: bool,
}

impl Queue {
    /// Checks a request's display generation against the newest seen, cancelling queued
    /// jobs from older generations when this request advances it.
    fn admit(&mut self, generation: Option<u64>) -> Result<()> {
        let Some(g) = generation else {
            return Ok(());
        };
        if g < self.latest_generation {
            return Err(cancelled());
        }
        if g > self.latest_generation {
            self.latest_generation = g;
            let (superseded, kept): (Vec<_>, Vec<_>) = std::mem::take(&mut self.jobs)
                .into_vec()
                .into_iter()
                .partition(|job| job.generation.is_some_and(|old| old < g));
            self.jobs = BinaryHeap::from(kept);
            for mut job in superseded {
                match job.take_reply() {
                    Reply::Page(tx) => {
                        let _ = tx.send(Err(cancelled()));
                    }
                    Reply::Preview(tx) => {
                        let _ = tx.send(Err(cancelled()));
                    }
                    Reply::Dimensions(_, _) | Reply::None => {}
                }
            }
        }
        Ok(())
    }
}

/// Everything a worker touches, reached through one `Arc`: the queue, the book id its
/// cache keys carry, the cache itself and the decode settings.
///
/// The cache lives here rather than on [`PageService`] because
/// [`PageService::set_cache`] replaces it wholesale — a second handle held by the workers
/// would go on filling a cache the state no longer reads. Holding all of it in one place
/// is also why a worker needs no context struct of its own.
struct Shared {
    book_id: String,
    queue: Mutex<Queue>,
    wake: Condvar,
    cache: RwLock<Cache>,
    /// Locked because the viewport it holds changes while the book is open: the reader
    /// resizes its window, and the next page has to be rendered for the new one.
    pipeline: RwLock<Pipeline>,
    /// How many reader threads this book has.
    workers: usize,
    /// How many of them preload may never occupy.
    ///
    /// Two wherever there are three or more readers, because the viewer displays two
    /// pages at once: a spread issues two foreground requests together and shows nothing
    /// until both land, so a single free worker would leave the reader waiting on the
    /// second exactly as before. It is a property of the viewer rather than of the
    /// two-page setting — two is the most foreground work one screen can ask for — so no
    /// setting is plumbed in here and nothing has to be updated when the reader toggles
    /// spreads. A book with one reader reserves nothing and still preloads.
    reserve: usize,
}

impl Shared {
    /// Locks the queue, recovering a poisoned lock rather than propagating it: a worker
    /// that panicked mid-job leaves no broken invariant behind, only a missing answer,
    /// and the caller waiting on it is already about to see a closed channel.
    fn lock(&self) -> MutexGuard<'_, Queue> {
        self.queue.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// The decode settings as they stand right now. `Pipeline` is `Copy`, so the lock is
    /// released before anything is read or resized.
    fn pipeline(&self) -> Pipeline {
        *self.pipeline.read().unwrap_or_else(|e| e.into_inner())
    }

    fn cached(&self, entry: &str, fit: Fit) -> Option<Arc<Image>> {
        self.cache
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get(&self.book_id, entry, fit)
    }

    fn store(&self, entry: &str, rendered: &Rendered) {
        self.cache
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .put(&self.book_id, entry, rendered);
    }
}

/// The error every blocked caller gets once its book is closed.
fn closed() -> Error {
    Error::BookClosed("The book was closed while a page was being read".to_string())
}

/// The error a caller gets when a newer display generation supersedes its request.
fn cancelled() -> Error {
    Error::RequestCancelled("A newer page request superseded this one".to_string())
}

/// How long a test waits for the scheduler before a job counts as never run.
#[cfg(test)]
const TEST_REPLY_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// Waits for a reply on a plain test thread, panicking instead of hanging when none comes.
///
/// The wait runs on a helper thread: a oneshot receiver has no blocking receive with a limit.
#[cfg(test)]
fn reply_within<T: Send + 'static>(
    rx: oneshot::Receiver<Result<T>>,
    limit: std::time::Duration,
) -> Result<T> {
    let (done_tx, done_rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = done_tx.send(rx.blocking_recv());
    });
    match done_rx.recv_timeout(limit) {
        Ok(reply) => reply.unwrap_or_else(|_| Err(closed())),
        Err(_) => panic!("no reply within {limit:?}: the job was never run"),
    }
}

/// Dropping it ends the watch that [`close_if_stuck`] started.
#[cfg(test)]
#[must_use = "dropping the watch ends it"]
pub(crate) struct StuckWatch {
    _finished: mpsc::Sender<()>,
}

/// Closes `service` after [`TEST_REPLY_TIMEOUT`], unless the returned watch is dropped first.
///
/// A wait inside the service has no limit of its own; closing the book drops the queued
/// jobs, so a wait for a job that was never run ends in an error and the test fails
/// instead of hanging.
#[cfg(test)]
pub(crate) fn close_if_stuck(service: &Arc<PageService>) -> StuckWatch {
    let (finished, stuck) = mpsc::channel::<()>();
    let service = service.clone();
    thread::spawn(move || {
        if stuck.recv_timeout(TEST_REPLY_TIMEOUT) == Err(mpsc::RecvTimeoutError::Timeout) {
            service.close();
        }
    });
    StuckWatch {
        _finished: finished,
    }
}

/// Owns every reader thread for one open book, plus the queue feeding them.
///
/// [`PageService::close`] discards the queued jobs and closes the queue; each worker
/// finishes the page it is on and exits, and every blocked caller is answered with an
/// error instead of waiting. `Drop` just calls it.
///
/// Closing is explicit rather than a consequence of the last `Arc` going away, because a
/// caller blocked inside [`PageService::dimensions`] *is* one of those `Arc`s: a book
/// switch that only dropped the state's handle would leave the outgoing book's scan
/// running against the incoming book's reads.
pub struct PageService {
    /// Handed back by [`PageService::container`], so the one handle the state keeps
    /// answers both "which book is open" and "what is it".
    container: Arc<dyn Container>,
    /// Entry name to position, built once: it is the tiebreak inside a priority class, so
    /// every enqueue needs it and none of them can afford a scan of `get_entries`.
    order: HashMap<String, usize>,
    /// How many reader threads were started for this book.
    workers: usize,
    shared: Arc<Shared>,
}

impl PageService {
    /// Starts the readers for one book.
    ///
    /// Each worker opens its reader lazily, on its first job, so a book that is closed
    /// immediately never pays for archive handles it will not use. A book with no entries
    /// (an EPUB novel) starts no workers at all; every request then fails on the entry
    /// lookup instead of queuing a job nothing would ever pop — the same invariant
    /// [`PageService::close`] upholds, that a blocking call always gets an answer.
    ///
    /// # Arguments
    ///
    /// * `book_id` - Unique identifier for the book (its path).
    /// * `container` - The book's structure, which mints the readers.
    /// * `pipeline` - How a page's bytes become an image.
    /// * `cache` - The global image cache.
    /// * `max_workers` - The reader's ceiling on reader threads; `0` picks one from the
    ///   machine's parallelism. `Container::max_readers` caps it either way.
    pub fn new(
        book_id: String,
        container: Arc<dyn Container>,
        pipeline: Pipeline,
        cache: Cache,
        max_workers: usize,
    ) -> Self {
        let order: HashMap<String, usize> = container
            .get_entries()
            .iter()
            .enumerate()
            .map(|(index, entry)| (entry.clone(), index))
            .collect();

        // The reader's ceiling, then the format's — which always wins, so a solid RAR
        // stays at one reader however high the setting goes.
        let workers = if order.is_empty() {
            0
        } else {
            let wanted = if max_workers == 0 {
                let cores = thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
                max(1, cores / 2)
            } else {
                max_workers
            };
            container.max_readers().min(wanted)
        };

        let shared = Arc::new(Shared {
            book_id,
            queue: Mutex::new(Queue {
                jobs: BinaryHeap::new(),
                preload: BinaryHeap::new(),
                in_flight: HashMap::new(),
                preloading: 0,
                live: workers,
                latest_generation: 0,
                closed: false,
            }),
            wake: Condvar::new(),
            cache: RwLock::new(cache),
            pipeline: RwLock::new(pipeline),
            workers,
            reserve: min(2, workers.saturating_sub(1)),
        });

        for index in 0..workers {
            let for_worker = shared.clone();
            let container = container.clone();
            // Detached on purpose. Teardown must never join: `close` is called from
            // `ContainerState` under the state write lock, and waiting there for a worker
            // to finish a page would hold every command behind an in-flight read.
            let spawned = thread::Builder::new()
                .name(format!("page-reader-{index}"))
                .spawn(move || worker(for_worker, container));
            if let Err(e) = spawned {
                log::error!("Failed to start a page reader thread: {e}");
                // The thread that would have counted itself out never ran.
                worker_left(&shared);
            }
        }

        // A book with pages and no reader at all: `max_readers` of 0, or every spawn
        // failing. Closing now is what turns a request into an error rather than a wait
        // for a worker that does not exist.
        if workers == 0 && !order.is_empty() {
            shared.lock().closed = true;
        }

        Self {
            container,
            order,
            workers,
            shared,
        }
    }

    /// How many reader threads this book was given.
    ///
    /// The container's `max_readers`, bounded by the machine's parallelism — the number
    /// that explains why one book preloads faster than another.
    pub fn workers(&self) -> usize {
        self.workers
    }

    /// The book this service reads.
    pub fn container(&self) -> Arc<dyn Container> {
        self.container.clone()
    }

    /// The book's identifier, which is its path.
    pub fn book_id(&self) -> &str {
        &self.shared.book_id
    }

    /// Replaces the cache every worker writes into.
    ///
    /// Takes `&self` so the service can be updated while shared behind an `Arc`.
    pub fn set_cache(&self, cache: Cache) {
        *self.shared.cache.write().unwrap_or_else(|e| e.into_inner()) = cache;
    }

    /// Reads one page, rendered for the viewport the frontend last reported.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name, as listed by the container.
    /// * `priority` - The job class the read is queued in.
    /// * `generation` - Optional display generation; a newer one cancels queued requests
    ///   from older generations, and an older one is refused immediately.
    ///
    /// # Returns
    ///
    /// The page, fitted to the viewport.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry is not part of this book, the book is closed while
    /// the page is being read, a newer display generation supersedes the request
    /// ([`Error::RequestCancelled`]), or the page cannot be read or decoded.
    pub async fn page(
        &self,
        entry: &str,
        priority: Priority,
        generation: Option<u64>,
    ) -> Result<Arc<Image>> {
        self.fetch(entry, priority, self.shared.pipeline().fit(), generation)
            .await
    }

    /// Reads one page fitted to the display box times `zoom`, for the loupe.
    ///
    /// The lens draws the page at 1:1 wherever the screen does, and never past the page's
    /// stored size or the height cap. At zoom 1 this hits the viewer's cached page.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name, as listed by the container.
    /// * `zoom` - The loupe's magnification factor.
    ///
    /// # Returns
    ///
    /// The page, fitted to `Pipeline::magnified_fit(zoom)`.
    ///
    /// # Errors
    ///
    /// As [`PageService::page`].
    pub async fn page_magnified(&self, entry: &str, zoom: f64) -> Result<Arc<Image>> {
        self.fetch(
            entry,
            Priority::Foreground,
            self.shared.pipeline().magnified_fit(zoom),
            None,
        )
        .await
    }

    /// [`PageService::page`] for a test running on a plain thread.
    #[cfg(test)]
    pub fn page_blocking(&self, entry: &str, priority: Priority) -> Result<Arc<Image>> {
        match self.enqueue(entry, priority, self.shared.pipeline().fit(), None)? {
            Fetch::Cached(image) => Ok(image),
            Fetch::Queued { rx, .. } => reply_within(rx, TEST_REPLY_TIMEOUT),
        }
    }

    /// [`PageService::page`] with a display generation, for a test running on a plain thread.
    #[cfg(test)]
    pub fn page_blocking_in(&self, entry: &str, generation: u64) -> Result<Arc<Image>> {
        match self.enqueue(
            entry,
            Priority::Foreground,
            self.shared.pipeline().fit(),
            Some(generation),
        )? {
            Fetch::Cached(image) => Ok(image),
            Fetch::Queued { rx, .. } => reply_within(rx, TEST_REPLY_TIMEOUT),
        }
    }

    /// [`PageService::page_magnified`] for a test running on a plain thread.
    #[cfg(test)]
    pub fn page_magnified_blocking(&self, entry: &str, zoom: f64) -> Result<Arc<Image>> {
        match self.enqueue(
            entry,
            Priority::Foreground,
            self.shared.pipeline().magnified_fit(zoom),
            None,
        )? {
            Fetch::Cached(image) => Ok(image),
            Fetch::Queued { rx, .. } => reply_within(rx, TEST_REPLY_TIMEOUT),
        }
    }

    /// [`PageService::preview`] for a test running on a plain thread.
    #[cfg(test)]
    pub fn preview_blocking(&self, entry: &str) -> Result<Option<Arc<Image>>> {
        match self.enqueue_preview(entry, None)? {
            Some(rx) => reply_within(rx, TEST_REPLY_TIMEOUT),
            None => Ok(None),
        }
    }

    /// [`PageService::preview`] with a display generation, for a test running on a plain thread.
    #[cfg(test)]
    pub fn preview_blocking_in(&self, entry: &str, generation: u64) -> Result<Option<Arc<Image>>> {
        match self.enqueue_preview(entry, Some(generation))? {
            Some(rx) => reply_within(rx, TEST_REPLY_TIMEOUT),
            None => Ok(None),
        }
    }

    /// Reports the reader's viewport in device pixels, and says whether it changed.
    ///
    /// Pages already read stay in the cache under the size they came out at, so a window
    /// that goes back to a size it has been, or changes in a way that leaves a page's size
    /// alone, is served from it.
    ///
    /// A change drops the preload not yet started, which was queued for the old size; a
    /// job a worker already took finishes.
    pub fn set_display_size(&self, size: Option<Fit>) -> bool {
        let mut pipeline = self
            .shared
            .pipeline
            .write()
            .unwrap_or_else(|e| e.into_inner());
        if pipeline.display == size {
            return false;
        }
        pipeline.display = size;
        // Under the pipeline lock, so a preload request that already read the new box
        // keeps its jobs. Nothing takes the pipeline lock while holding the queue.
        self.shared.lock().preload.clear();
        true
    }

    /// Applies the reader's height cap and resize filter to every page read from now on.
    ///
    /// The cache knows nothing of these, so the caller empties it.
    pub fn set_rendering(&self, max_image_height: u32, resize_method: ResizeFilter) {
        let mut pipeline = self
            .shared
            .pipeline
            .write()
            .unwrap_or_else(|e| e.into_inner());
        pipeline.max_image_height = max_image_height;
        pipeline.resize_method = resize_method;
    }

    /// Reads one page into `fit`, waiting for it, and records the wait.
    async fn fetch(
        &self,
        entry: &str,
        priority: Priority,
        fit: Fit,
        generation: Option<u64>,
    ) -> Result<Arc<Image>> {
        let span = Span::start();
        let (page, source, queued) = match self.enqueue(entry, priority, fit, generation) {
            Ok(Fetch::Cached(image)) => (Ok(image), "cache", 0),
            Ok(Fetch::Queued { rx, source, queued }) => {
                let result = rx.await.unwrap_or_else(|_| Err(closed()));
                let source = if matches!(result, Err(Error::RequestCancelled(_))) {
                    "cancelled"
                } else {
                    source
                };
                (result, source, queued)
            }
            Err(e @ Error::RequestCancelled(_)) => (Err(e), "cancelled", 0),
            Err(e) => return Err(e),
        };
        // What the wait was spent on, which is what makes the duration readable: a page
        // already being read is joined rather than read again.
        perf!(
            span,
            "page",
            "entry={entry} prio={priority:?} source={source} queued={queued}"
        );
        page
    }

    /// Queues one page read into `fit`, or answers it from the cache.
    ///
    /// Cache first; only a miss reaches the queue.
    fn enqueue(
        &self,
        entry: &str,
        priority: Priority,
        fit: Fit,
        generation: Option<u64>,
    ) -> Result<Fetch> {
        if let Some(image) = self.shared.cached(entry, fit) {
            if generation.is_some() {
                self.shared.lock().admit(generation)?;
            }
            return Ok(Fetch::Cached(image));
        }

        let index = self.index_of(entry)?;
        let (tx, rx) = oneshot::channel();
        let (source, queued) = {
            let mut queue = self.shared.lock();
            if queue.closed {
                return Err(closed());
            }
            queue.admit(generation)?;
            let queued = queue.jobs.len() + queue.preload.len();
            match queue.in_flight.entry((entry.to_string(), fit)) {
                // A worker already has this page open; wait on its result rather than
                // reading the same bytes twice.
                Entry::Occupied(mut waiting) => {
                    waiting.get_mut().push(tx);
                    ("inflight", queued)
                }
                Entry::Vacant(_) => {
                    queue.jobs.push(Job {
                        priority,
                        order: (index, 1),
                        entry: entry.to_string(),
                        fit,
                        generation,
                        reply: Reply::Page(tx),
                    });
                    ("read", queued)
                }
            }
        };
        self.shared.wake.notify_one();
        Ok(Fetch::Queued { rx, source, queued })
    }

    /// Reads a small stand-in for one page, if its format has a cheaper path to one.
    ///
    /// Ordered before the same entry's page, because the frontend only asks for previews
    /// of the pages it is displaying right now.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name, as listed by the container.
    /// * `generation` - Optional display generation; a newer one cancels queued requests
    ///   from older generations, and an older one is refused immediately.
    ///
    /// # Returns
    ///
    /// `Ok(None)` when the full page is already cached, or the format has no preview.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry is not part of this book, the book is closed, a
    /// newer display generation supersedes the request ([`Error::RequestCancelled`]), or
    /// the preview cannot be produced.
    pub async fn preview(
        &self,
        entry: &str,
        generation: Option<u64>,
    ) -> Result<Option<Arc<Image>>> {
        let span = Span::start();
        let (preview, source) = match self.enqueue_preview(entry, generation) {
            Ok(None) => (Ok(None), "cached-page"),
            Ok(Some(rx)) => {
                let preview = rx.await.unwrap_or_else(|_| Err(closed()));
                let source = match &preview {
                    Ok(Some(_)) => "render",
                    // Every format but PDF: a preview costs the page's own read and decode, so
                    // there is nothing cheaper to make.
                    Ok(None) => "unsupported",
                    Err(Error::RequestCancelled(_)) => "cancelled",
                    Err(_) => "failed",
                };
                (preview, source)
            }
            Err(e @ Error::RequestCancelled(_)) => (Err(e), "cancelled"),
            Err(e) => return Err(e),
        };
        perf!(span, "preview", "entry={entry} source={source}");
        preview
    }

    /// Queues one preview, ordered before the same entry's page.
    ///
    /// # Returns
    ///
    /// `None` when the full page is already cached and no preview is needed.
    fn enqueue_preview(&self, entry: &str, generation: Option<u64>) -> Result<Option<PreviewRx>> {
        if self
            .shared
            .cached(entry, self.shared.pipeline().fit())
            .is_some()
        {
            if generation.is_some() {
                self.shared.lock().admit(generation)?;
            }
            return Ok(None);
        }

        let index = self.index_of(entry)?;
        let (tx, rx) = oneshot::channel();
        {
            let mut queue = self.shared.lock();
            if queue.closed {
                return Err(closed());
            }
            queue.admit(generation)?;
            queue.jobs.push(Job {
                priority: Priority::Foreground,
                order: (index, 0),
                entry: entry.to_string(),
                // The pipeline fits a preview to PREVIEW, so no box bounds it here.
                fit: Fit::UNBOUNDED,
                generation,
                reply: Reply::Preview(tx),
            });
        }
        self.shared.wake.notify_one();
        Ok(Some(rx))
    }

    /// Enqueues the window around `center`, skipping entries already cached.
    ///
    /// `center + caller_pages ..= center + buffer` goes in as [`Priority::PreloadAhead`]
    /// and `center - buffer..center` as [`Priority::PreloadBehind`], both in ascending
    /// entry order.
    ///
    /// `caller_pages` is how many pages from `center` the caller is fetching itself, and
    /// they are left out. The viewer requests its own unit at [`Priority::Foreground`];
    /// preloading those same pages only lets a background job reach them first, and a job
    /// already picked up cannot be outranked — so the foreground request would attach to
    /// it and wait. Nothing is lost by skipping them: they are the pages already on their
    /// way.
    ///
    /// Un-started preload jobs from the previous window are dropped first: the frontend
    /// calls this on every page turn, and a window the reader has left must not outrank
    /// the one they are in. A job a worker has already picked up still finishes. Foreground
    /// requests are superseded by display generations, preload by this call, and book
    /// switches by [`PageService::close`].
    pub fn request_preload_around(
        &self,
        center: usize,
        buffer: usize,
        caller_pages: usize,
    ) -> Result<()> {
        let entries = self.container.get_entries();
        if entries.is_empty() {
            return Ok(());
        }

        let start = center.saturating_sub(buffer);
        let end = center
            .saturating_add(buffer)
            .saturating_add(1)
            .min(entries.len());
        let first_ahead = center.saturating_add(caller_pages).min(entries.len());
        let ahead = first_ahead..end.max(first_ahead);
        let behind = start..center.min(entries.len());

        let span = Span::start();
        let (ahead_len, behind_len) = (ahead.len(), behind.len());
        let mut cached = 0usize;

        // Read once, so a whole window is preloaded into one box even if the reader is
        // resizing the window while it is queued.
        let fit = self.shared.pipeline().fit();

        let mut queue = self.shared.lock();
        if queue.closed {
            return Ok(());
        }
        let dropped = queue.preload.len();
        queue.preload.clear();

        for (range, priority) in [
            (ahead, Priority::PreloadAhead),
            (behind, Priority::PreloadBehind),
        ] {
            for index in range {
                let entry = &entries[index];
                if self.shared.cached(entry, fit).is_some() {
                    cached += 1;
                    continue;
                }
                queue.preload.push(Job {
                    priority,
                    order: (index, 1),
                    entry: entry.clone(),
                    fit,
                    generation: None,
                    reply: Reply::None,
                });
            }
        }
        drop(queue);
        self.shared.wake.notify_all();

        // `dropped` is the pages of a window the reader has already left, which is the
        // number that says whether preloading is chasing them or lagging behind.
        perf!(
            span,
            "preload",
            "center={center} skipped={caller_pages} ahead={ahead_len} behind={behind_len} cached={cached} dropped={dropped}"
        );

        Ok(())
    }

    /// Measures every page, in entry order.
    ///
    /// One [`Priority::Scan`] job per entry, so foreground work overtakes the scan at the
    /// very next job rather than after all of it.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the book is closed mid-scan, or a page cannot be measured.
    pub fn dimensions(&self) -> Result<Vec<ImageDimensions>> {
        let entries = self.container.get_entries().clone();
        if entries.is_empty() {
            return Ok(Vec::new());
        }

        let (tx, rx) = mpsc::channel();
        {
            let mut queue = self.shared.lock();
            if queue.closed {
                return Err(closed());
            }
            for (index, entry) in entries.iter().enumerate() {
                queue.jobs.push(Job {
                    priority: Priority::Scan,
                    order: (index, 1),
                    entry: entry.clone(),
                    // A scan measures the stored page's header and never renders it.
                    fit: Fit::UNBOUNDED,
                    generation: None,
                    reply: Reply::Dimensions(index, tx.clone()),
                });
            }
        }
        // The queue holds the only remaining senders, so `recv` reports a closed book
        // instead of blocking once `close` has dropped them.
        drop(tx);
        self.shared.wake.notify_all();

        let span = Span::start();
        let mut failed = 0usize;
        let mut measured: Vec<Option<ImageDimensions>> = vec![None; entries.len()];
        for _ in 0..entries.len() {
            let (index, result) = rx.recv().map_err(|_| closed())?;
            measured[index] = Some(result.unwrap_or_else(|e| {
                // One unreadable page must not cost a book its two-page view: the viewer
                // holds its layout until this scan lands, so failing the whole scan would
                // leave the book on single pages. A zero-sized page reads as portrait,
                // which is the pairing a page of unknown shape gets anyway.
                log::warn!("Could not measure {}: {e}", entries[index]);
                failed += 1;
                ImageDimensions {
                    width: 0,
                    height: 0,
                }
            }));
        }

        // One record for the whole scan, never one per page: two hundred lines would cost
        // more in log I/O than the scan costs in work.
        let pages = entries.len();
        perf!(span, "scan", "pages={pages} failed={failed}");

        measured
            .into_iter()
            .map(|dimensions| dimensions.ok_or_else(closed))
            .collect()
    }

    /// How many jobs are queued or being read, for a test that asserts nothing was asked
    /// for.
    #[cfg(test)]
    pub fn pending(&self) -> usize {
        let queue = self.shared.lock();
        queue.jobs.len() + queue.preload.len() + queue.in_flight.len()
    }

    /// Reads one page straight from the cache, without queuing anything.
    ///
    /// At the current viewport: a page cached for a window the reader has since resized
    /// is not the page they would be shown.
    pub fn cached(&self, entry: &str) -> Option<Arc<Image>> {
        self.shared.cached(entry, self.shared.pipeline().fit())
    }

    /// Drops every queued job, closes the queue and lets the workers exit.
    ///
    /// Idempotent, takes `&self`, and answers blocked callers with an error rather than
    /// leaving them waiting: dropping the queued jobs drops the senders they carry, which
    /// is what wakes a `recv`. It never joins a worker, so a caller may close a book
    /// while a page is still being read.
    pub fn close(&self) {
        let span = Span::start();
        let (queued, inflight) = shutdown(&mut self.shared.lock());
        self.shared.wake.notify_all();
        perf!(span, "close", "queued={queued} inflight={inflight}");
    }

    /// The entry's position in the book.
    fn index_of(&self, entry: &str) -> Result<usize> {
        self.order.get(entry).copied().ok_or_else(|| {
            Error::EntryNotFound(format!(
                "Entry not found in {}: {entry}",
                self.shared.book_id
            ))
        })
    }
}

impl Drop for PageService {
    fn drop(&mut self) {
        self.close();
    }
}

/// Closes the queue and drops every job it holds, reporting what was discarded.
///
/// Dropping the jobs drops the reply senders they carry, which is what turns a caller's
/// blocked `recv` into an error instead of a wait with no end.
fn shutdown(queue: &mut Queue) -> (usize, usize) {
    queue.closed = true;
    let counts = (
        queue.jobs.len() + queue.preload.len(),
        queue.in_flight.len(),
    );
    queue.jobs.clear();
    queue.preload.clear();
    queue.in_flight.clear();
    counts
}

/// Counts one reader thread out, closing the queue when the last one is gone.
fn worker_left(shared: &Shared) {
    let mut queue = shared.lock();
    queue.live -= 1;
    if queue.live == 0 {
        shutdown(&mut queue);
        shared.wake.notify_all();
    }
}

/// Counts one reader thread for as long as it runs.
///
/// A `Drop` rather than a line at each exit, so a thread that unwinds is counted out by
/// the same code as one that returns.
struct WorkerLife<'a>(&'a Shared);

impl Drop for WorkerLife<'_> {
    fn drop(&mut self) {
        worker_left(self.0);
    }
}

/// Answers the callers attached to one page, however the job ends.
///
/// A worker that leaves mid-read would otherwise leave the entry in `in_flight` forever,
/// and every later request for that page would attach to a read nobody is performing.
struct Delivery<'a> {
    shared: &'a Shared,
    /// The read still owed an answer, taken once one has been given.
    entry: Option<ReadKey>,
}

impl Delivery<'_> {
    /// Records that the waiters have been answered.
    fn done(&mut self) {
        self.entry = None;
    }
}

impl Drop for Delivery<'_> {
    fn drop(&mut self) {
        let Some(key) = self.entry.take() else {
            return;
        };
        // Dropping the senders is what wakes a blocked `recv`; there is no result to
        // send, because whatever was going to produce one is gone.
        self.shared.lock().in_flight.remove(&key);
    }
}

/// One reader thread's whole life.
fn worker(shared: Arc<Shared>, container: Arc<dyn Container>) {
    let _life = WorkerLife(&shared);
    let mut reader: Option<Box<dyn PageReader>> = None;

    loop {
        let Some(mut job) = next_job(&shared) else {
            return;
        };
        let _slot = PreloadSlot(job.priority.is_preload().then_some(&*shared));
        // Armed for the length of this job: whatever ends it — a delivery, an early
        // return, an unwind out of the decoder — the callers attached to this entry are
        // let go rather than left waiting on a read that is no longer running.
        //
        // Declared after `job`, so on an unwind it is dropped first: `in_flight` is
        // cleared before the job's own reply is. The other way round, a request made
        // between the two would attach to a read nobody is performing.
        let mut delivery = Delivery {
            shared: &shared,
            entry: job.reads_the_page().then(|| (job.entry.clone(), job.fit)),
        };

        // Another worker may have cached this page between the enqueue and this pop.
        // Answer from the cache rather than skipping the job: skipping would drop
        // `job.reply` with it, and a caller blocked in `page()` would see a closed
        // channel — a spurious failure on what is in fact a cache hit.
        if job.reads_the_page() {
            if let Some(image) = shared.cached(&job.entry, job.fit) {
                deliver_page(&shared, &mut job, Ok(image));
                delivery.done();
                continue;
            }
        }

        // Opened on the first job rather than at construction, so a book closed straight
        // after opening never pays for an archive handle it will not use.
        if reader.is_none() {
            match container.open_reader() {
                Ok(opened) => reader = Some(opened),
                Err(e) => {
                    deliver_error(&shared, &mut job, &e);
                    delivery.done();
                    // The handle will not appear on a retry, so leave rather than fail
                    // every remaining job one at a time. Whatever is still queued is
                    // failed by `worker_left` once the last reader has gone.
                    log::error!("Failed to open a page reader: {e}");
                    return;
                }
            }
        }
        let Some(reader) = reader.as_mut() else {
            return;
        };

        run(&shared, reader.as_mut(), &mut job);
        delivery.done();
    }
}

/// Pops the next job, registering a page read in `in_flight` before releasing the lock.
///
/// The lock is never held across a read, a decode or a resize: holding it there is
/// exactly the mistake that makes an un-restructured ZIP scan block page 0 for half a
/// second. Returns `None` once the book is closed.
fn next_job(shared: &Shared) -> Option<Job> {
    let mut guard = shared.lock();
    loop {
        {
            let queue = &mut *guard;
            if queue.closed {
                return None;
            }

            // Preload is taken only while it would leave the reader a worker to be
            // served by; the rest of the queue is taken as before, so the reserve costs
            // preload throughput and never correctness.
            let may_preload = queue.preloading + shared.reserve < shared.workers;
            let take_preload = match (queue.jobs.peek(), queue.preload.peek()) {
                (_, None) => false,
                (None, Some(_)) => may_preload,
                // `Ord` is reversed for the heap, so the greater job is the higher
                // priority one. Preload before the scan, after the foreground.
                (Some(next), Some(ahead)) => may_preload && ahead > next,
            };

            let next = if take_preload {
                queue.preload.pop()
            } else {
                queue.jobs.pop()
            };
            if let Some(job) = next {
                if job.reads_the_page() {
                    match queue.in_flight.entry((job.entry.clone(), job.fit)) {
                        // Two callers asked for the same page before either was picked
                        // up. Wait on the one that is running instead of reading the
                        // bytes twice.
                        Entry::Occupied(mut waiting) => {
                            if let Reply::Page(tx) = job.reply {
                                waiting.get_mut().push(tx);
                            }
                            // Absorbed rather than taken, so it holds no worker.
                            continue;
                        }
                        Entry::Vacant(slot) => {
                            slot.insert(Vec::new());
                        }
                    }
                }
                if take_preload {
                    queue.preloading += 1;
                }
                return Some(job);
            }
        }
        guard = shared
            .wake
            .wait(guard)
            .unwrap_or_else(|poisoned| poisoned.into_inner());
    }
}

/// Holds a worker's preload slot, and gives it back however the job ends.
///
/// A slot leaked by an early return would shrink the pool for the life of the book, so
/// releasing it is a `Drop` rather than a line at each exit.
struct PreloadSlot<'a>(Option<&'a Shared>);

impl Drop for PreloadSlot<'_> {
    fn drop(&mut self) {
        if let Some(shared) = self.0 {
            shared.lock().preloading -= 1;
            // A freed slot may be exactly what a waiting worker needs.
            shared.wake.notify_one();
        }
    }
}

/// Runs one job and answers everyone waiting on it.
///
/// The job is borrowed rather than moved, and its reply taken only once the read is
/// over: moved in, the reply would be dropped by an unwind out of the read before the
/// worker's `Delivery` guard runs, and the caller would be answered while `in_flight`
/// still names the page.
fn run(shared: &Shared, reader: &mut dyn PageReader, job: &mut Job) {
    match &job.reply {
        Reply::Dimensions(index, tx) => {
            let _ = tx.send((*index, reader.page_dimensions(&job.entry)));
        }
        Reply::Preview(_) => {
            let preview = reader
                .read_preview(&job.entry)
                .and_then(|page| page.map(|page| Pipeline::preview(&page)).transpose());
            if let Reply::Preview(tx) = job.take_reply() {
                let _ = tx.send(preview);
            }
        }
        Reply::Page(_) | Reply::None => {
            // The fit comes from the job, not from the pipeline as it stands now: a
            // viewport change mid-read must not hand the callers waiting on this box a page
            // fitted to another.
            let pipeline = shared.pipeline();
            let page = reader
                .read_page(&job.entry)
                .and_then(|page| pipeline.page(page, job.fit))
                .map(|rendered| {
                    shared.store(&job.entry, &rendered);
                    rendered.image
                });
            deliver_page(shared, job, page);
        }
    }
}

/// Sends a page result to the job's own caller and to everyone who attached to it.
fn deliver_page(shared: &Shared, job: &mut Job, result: Result<Arc<Image>>) {
    let waiting = shared
        .lock()
        .in_flight
        .remove(&(job.entry.clone(), job.fit))
        .unwrap_or_default();

    for tx in waiting {
        let _ = tx.send(result.clone());
    }
    if let Reply::Page(tx) = job.take_reply() {
        let _ = tx.send(result);
    }
}

/// Fails one job, and anything attached to it, without having read anything.
fn deliver_error(shared: &Shared, job: &mut Job, error: &Error) {
    if job.reads_the_page() {
        deliver_page(shared, job, Err(error.clone()));
        return;
    }
    match job.take_reply() {
        Reply::Dimensions(index, tx) => {
            let _ = tx.send((index, Err(error.clone())));
        }
        Reply::Preview(tx) => {
            let _ = tx.send(Err(error.clone()));
        }
        Reply::Page(_) | Reply::None => {}
    }
}

#[cfg(test)]
mod tests {
    use std::{
        io::Cursor,
        sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering},
            Barrier,
        },
        time::Duration,
    };

    use crate::{
        container::traits::{MockContainer, MockPageReader, PageData},
        image::{resizer::ResizeFilter, thumbnail::PREVIEW},
    };

    use super::*;

    /// A real PNG of `width` x `height`. Pages travel as encoded bytes and are decoded by the pipeline.
    fn page_bytes_sized(width: u32, height: u32) -> Vec<u8> {
        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(width, height))
            .write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
            .expect("failed to encode the page fixture");
        buffer
    }

    /// A real 4x2 PNG. Pages travel as encoded bytes and are decoded by the pipeline.
    fn page_bytes() -> Vec<u8> {
        page_bytes_sized(4, 2)
    }

    fn entries(count: usize) -> Vec<String> {
        (0..count).map(|index| format!("p{index:03}.png")).collect()
    }

    fn pipeline() -> Pipeline {
        Pipeline {
            display: None,
            max_image_height: 0,
            resize_method: ResizeFilter::Bilinear,
        }
    }

    fn service(container: MockContainer) -> PageService {
        PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            0,
        )
    }

    /// A container whose readers record the order in which pages are read.
    ///
    /// `readers` caps how many may be opened, which is how a test pins the whole book to
    /// one worker and makes the queue order observable.
    fn recording_container(
        names: Vec<String>,
        readers: usize,
        log: Arc<Mutex<Vec<String>>>,
    ) -> MockContainer {
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names);
        container.expect_max_readers().return_const(readers);
        container.expect_open_reader().returning(move || {
            let read_log = log.clone();
            let measure_log = log.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                read_log.lock().unwrap().push(entry.to_string());
                Ok(PageData::Encoded(page_bytes()))
            });
            reader.expect_page_dimensions().returning(move |entry| {
                measure_log.lock().unwrap().push(entry.to_string());
                Ok(ImageDimensions {
                    width: 4,
                    height: 2,
                })
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        container
    }

    /// How many jobs are waiting, and which entries are being read right now.
    ///
    /// The tests below are in this module, so they can wait on the scheduler's own state
    /// instead of sleeping long enough to usually be right.
    fn queued(service: &PageService) -> usize {
        let queue = service.shared.lock();
        queue.jobs.len() + queue.preload.len()
    }

    fn reading(service: &PageService, entry: &str) -> bool {
        let fit = service.shared.pipeline().fit();
        service
            .shared
            .lock()
            .in_flight
            .contains_key(&(entry.to_string(), fit))
    }

    /// Waits until `check` holds, or fails after a second.
    ///
    /// The scheduler answers on other threads, so a test that asserts immediately would
    /// be racing it; a deadline is what keeps a genuine hang from turning into a hung CI.
    fn eventually(what: &str, mut check: impl FnMut() -> bool) {
        for _ in 0..200 {
            if check() {
                return;
            }
            thread::sleep(Duration::from_millis(5));
        }
        panic!("timed out waiting for {what}");
    }

    #[test]
    fn a_foreground_page_is_served_at_the_next_job_of_a_running_scan() {
        let names = entries(8);
        let log = Arc::new(Mutex::new(Vec::new()));

        // One worker, parked inside its first scan job until this test releases it. That
        // is what makes the result deterministic rather than a race: the worker cannot
        // have started anything else, so whatever it reads next was chosen purely by
        // priority.
        let gate = Arc::new(Barrier::new(2));
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        let reader_gate = gate.clone();
        let reader_log = log.clone();
        container.expect_open_reader().returning(move || {
            let gate = reader_gate.clone();
            let measure_log = reader_log.clone();
            let read_log = reader_log.clone();
            let first = Arc::new(AtomicUsize::new(0));
            let mut reader = MockPageReader::new();
            reader.expect_page_dimensions().returning(move |entry| {
                measure_log.lock().unwrap().push(entry.to_string());
                if first.fetch_add(1, Ordering::SeqCst) == 0 {
                    gate.wait();
                }
                Ok(ImageDimensions {
                    width: 4,
                    height: 2,
                })
            });
            reader.expect_read_page().returning(move |entry| {
                read_log.lock().unwrap().push(entry.to_string());
                Ok(PageData::Encoded(page_bytes()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(service(container));
        let scanner = {
            let service = service.clone();
            thread::spawn(move || service.dimensions())
        };

        // Only once the worker is parked inside the scan's first job is there a scan for
        // the foreground request to overtake. Asking earlier would let the request be
        // served before the scan had even queued, which proves nothing about priority.
        eventually("the worker to park on its first page", || {
            !log.lock().unwrap().is_empty()
        });

        // The last page of the book, so entry order cannot be what puts it early.
        let wanted = names[7].clone();
        let foreground = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page_blocking(&wanted, Priority::Foreground))
        };
        // Seven scan jobs are left in the queue; the eighth is the foreground request,
        // and waiting for it to arrive is what makes the pop below decide this test.
        eventually("the foreground request to be queued", || {
            queued(&service) == 8
        });

        // Release the parked worker; its next pop decides this test.
        gate.wait();
        assert!(foreground.join().unwrap().is_ok());

        let read = log.lock().unwrap().clone();
        assert_eq!(
            read.get(1),
            Some(&wanted),
            "the foreground page must be the very next job, not wait out the scan: {read:?}"
        );

        service.close();
        let _ = scanner.join();
    }

    #[test]
    fn a_preload_window_is_served_ahead_first_and_in_entry_order() {
        let names = entries(10);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(names.clone(), 1, log.clone()));

        service.request_preload_around(5, 2, 0).unwrap();
        eventually("the window to be read", || log.lock().unwrap().len() == 5);

        let read = log.lock().unwrap().clone();
        // Ahead (5, 6, 7) before behind (3, 4), each class in ascending entry order so a
        // cursor reader never rewinds inside one.
        assert_eq!(
            read,
            vec![
                names[5].clone(),
                names[6].clone(),
                names[7].clone(),
                names[3].clone(),
                names[4].clone(),
            ]
        );
    }

    #[test]
    fn a_huge_preload_buffer_does_not_overflow() {
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(entries(3), 1, log));

        assert!(service.request_preload_around(0, usize::MAX, 0).is_ok());
        service.close();
    }

    #[test]
    fn a_preload_window_leaves_out_the_pages_the_caller_is_fetching() {
        let names = entries(10);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(names.clone(), 1, log.clone()));

        // A spread: the viewer asks for 5 and 6 itself, at foreground priority.
        service.request_preload_around(5, 2, 2).unwrap();
        eventually("the queue to drain", || {
            let queue = service.shared.lock();
            queue.jobs.is_empty() && queue.preload.is_empty() && queue.in_flight.is_empty()
        });

        let read = log.lock().unwrap().clone();
        // Ahead resumes past the pair; behind is untouched by the skip.
        assert_eq!(
            read,
            vec![names[7].clone(), names[3].clone(), names[4].clone()],
            "preload read a page the caller was already fetching"
        );
    }

    /// A gate the test opens once, for every reader at once.
    ///
    /// A `Barrier` cannot express this: the tests below hold an unknown number of reads
    /// and release them from a thread that is not one of them.
    #[derive(Default)]
    struct Latch {
        open: Mutex<bool>,
        changed: Condvar,
    }

    impl Latch {
        fn wait(&self) {
            let mut open = self.open.lock().unwrap();
            while !*open {
                open = self.changed.wait(open).unwrap();
            }
        }

        fn open(&self) {
            *self.open.lock().unwrap() = true;
            self.changed.notify_all();
        }
    }

    /// A container whose page reads park until `latch` opens.
    ///
    /// `free` is the one entry that reads straight through, which is how a test asks for
    /// a page while every other read is held. Measuring never parks, so a scan can be
    /// watched against held reads too.
    fn latched_container(
        names: Vec<String>,
        readers: usize,
        free: String,
        latch: Arc<Latch>,
    ) -> MockContainer {
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names);
        container.expect_max_readers().return_const(readers);
        container.expect_open_reader().returning(move || {
            let latch = latch.clone();
            let free = free.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                if entry != free {
                    latch.wait();
                }
                Ok(PageData::Encoded(page_bytes()))
            });
            reader.expect_page_dimensions().returning(|_| {
                Ok(ImageDimensions {
                    width: 4,
                    height: 2,
                })
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        container
    }

    /// Four readers held by preload, with the two reserved workers still free.
    fn service_with_preload_at_its_ceiling(
        names: &[String],
        free: &str,
        latch: Arc<Latch>,
    ) -> Arc<PageService> {
        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(latched_container(
                names.to_vec(),
                8,
                free.to_string(),
                latch,
            )),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            4,
        ));
        assert_eq!((service.shared.workers, service.shared.reserve), (4, 2));

        service.request_preload_around(0, 10, 0).unwrap();
        // At least two, so that a build without the reserve fails on what the reserve is
        // for — the request below — rather than here.
        eventually("preload to take a worker", || {
            service.shared.lock().preloading >= 2
        });
        service
    }

    #[test]
    fn a_foreground_page_is_served_while_preload_holds_every_worker_it_may() {
        let names = entries(30);
        let wanted = names[20].clone();
        let latch = Arc::new(Latch::default());
        let service = service_with_preload_at_its_ceiling(&names, &wanted, latch.clone());

        // On another thread: a foreground request that never returns must fail this test
        // as a timeout, not hang it.
        let served = Arc::new(AtomicUsize::new(0));
        let foreground = {
            let service = service.clone();
            let served = served.clone();
            thread::spawn(move || {
                let page = service.page_blocking(&wanted, Priority::Foreground);
                served.fetch_add(1, Ordering::SeqCst);
                page
            })
        };

        eventually("the foreground page", || served.load(Ordering::SeqCst) == 1);
        assert!(foreground.join().unwrap().is_ok());
        // Served by a reserved worker: the two preload reads never finished.
        assert_eq!(service.shared.lock().preloading, 2);

        latch.open();
        service.close();
    }

    #[test]
    fn a_scan_is_not_held_back_by_the_reserve() {
        let names = entries(30);
        let latch = Arc::new(Latch::default());
        let service = service_with_preload_at_its_ceiling(&names, &names[20], latch.clone());

        let scanned = Arc::new(AtomicUsize::new(0));
        let scanner = {
            let service = service.clone();
            let scanned = scanned.clone();
            thread::spawn(move || {
                let measured = service.dimensions();
                scanned.fetch_add(1, Ordering::SeqCst);
                measured
            })
        };

        eventually("the scan", || scanned.load(Ordering::SeqCst) == 1);
        assert_eq!(scanner.join().unwrap().unwrap().len(), names.len());

        latch.open();
        service.close();
    }

    #[test]
    fn a_book_with_one_reader_reserves_nothing_and_still_preloads() {
        let names = entries(5);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(names, 1, log.clone()));

        // A solid RAR or an EPUB: reserving a worker here would reserve the only one.
        assert_eq!((service.shared.workers, service.shared.reserve), (1, 0));

        service.request_preload_around(0, 2, 0).unwrap();
        eventually("the window to be read", || log.lock().unwrap().len() == 3);
    }

    #[test]
    fn the_reader_caps_the_pool_and_the_format_caps_it_lower() {
        let names = entries(4);
        let log = Arc::new(Mutex::new(Vec::new()));
        let build = |readers: usize, max_workers: usize| {
            PageService::new(
                "book".to_string(),
                Arc::new(recording_container(names.clone(), readers, log.clone())),
                pipeline(),
                Cache::new(mini_moka::sync::Cache::new(1000)),
                max_workers,
            )
        };

        // 0 is the setting's default: the machine answers, and never with none.
        assert!(build(64, 0).shared.workers >= 1);

        assert_eq!(build(64, 3).shared.workers, 3);
        // The format's own limit wins however high the reader sets theirs.
        assert_eq!(build(1, 8).shared.workers, 1);

        // Reserve two wherever there are three, one of two, and none of one.
        assert_eq!(build(64, 3).shared.reserve, 2);
        assert_eq!(build(64, 2).shared.reserve, 1);
        assert_eq!(build(1, 8).shared.reserve, 0);
    }

    #[test]
    fn a_book_whose_readers_cannot_open_fails_every_caller() {
        let names = entries(4);
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        container
            .expect_open_reader()
            .returning(|| Err(Error::Other("no handle".to_string())));
        let service = Arc::new(service(container));

        // Two pages, so the second is one the failing worker never reached: it is the job
        // that used to sit in the queue with nobody left to pop it.
        let answered = Arc::new(AtomicUsize::new(0));
        let waiting: Vec<_> = names
            .iter()
            .take(2)
            .map(|name| {
                let (service, answered, name) = (service.clone(), answered.clone(), name.clone());
                thread::spawn(move || {
                    let page = service.page_blocking(&name, Priority::Foreground);
                    answered.fetch_add(1, Ordering::SeqCst);
                    page
                })
            })
            .collect();

        eventually("both callers to be answered", || {
            answered.load(Ordering::SeqCst) == 2
        });
        for handle in waiting {
            assert!(
                handle.join().unwrap().is_err(),
                "a page no reader can produce must fail rather than wait"
            );
        }
    }

    #[test]
    fn a_page_a_dead_worker_never_finished_is_read_by_another() {
        let names = entries(4);
        let doomed = names[0].clone();
        let reads = Arc::new(AtomicUsize::new(0));

        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(usize::MAX);
        let (target, count) = (doomed.clone(), reads.clone());
        container.expect_open_reader().returning(move || {
            let (target, count) = (target.clone(), count.clone());
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                // The first read of this page takes its worker down with it, exactly as an
                // unwind out of the decoder would. The thread is detached, so the panic is
                // reported on stderr and fails nothing by itself.
                if entry == target && count.fetch_add(1, Ordering::SeqCst) == 0 {
                    panic!("the reader died mid-page");
                }
                Ok(PageData::Encoded(page_bytes()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            2,
        ));

        assert!(
            service
                .page_blocking(&doomed, Priority::Foreground)
                .is_err(),
            "the caller whose worker died must be told"
        );

        // The entry must no longer be marked as being read: a second request has to queue
        // a job of its own rather than attach to a read nobody is performing.
        let served = Arc::new(AtomicUsize::new(0));
        let again = {
            let (service, served, doomed) = (service.clone(), served.clone(), doomed.clone());
            thread::spawn(move || {
                let page = service.page_blocking(&doomed, Priority::Foreground);
                served.fetch_add(1, Ordering::SeqCst);
                page
            })
        };
        eventually("the page to be read again", || {
            served.load(Ordering::SeqCst) == 1
        });
        assert!(again.join().unwrap().is_ok());
    }

    #[test]
    fn a_book_with_no_readers_answers_instead_of_queueing() {
        let names = entries(3);
        let log = Arc::new(Mutex::new(Vec::new()));
        // A format that admits no reader at all: nothing would ever pop a job.
        let service = service(recording_container(names.clone(), 0, log));

        assert_eq!(service.workers(), 0);
        assert!(service
            .page_blocking(&names[0], Priority::Foreground)
            .is_err());
        assert!(service.dimensions().is_err());
    }

    #[test]
    fn a_new_window_discards_the_pages_the_reader_has_left() {
        let names = entries(40);
        let log = Arc::new(Mutex::new(Vec::new()));

        // One worker, held on its first page until the second window has been requested.
        let gate = Arc::new(Barrier::new(2));
        let parked = Arc::new(AtomicBool::new(false));
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        let reader_gate = gate.clone();
        let reader_parked = parked.clone();
        let reader_log = log.clone();
        container.expect_open_reader().returning(move || {
            let gate = reader_gate.clone();
            let parked = reader_parked.clone();
            let log = reader_log.clone();
            let first = Arc::new(AtomicUsize::new(0));
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                if first.fetch_add(1, Ordering::SeqCst) == 0 {
                    parked.store(true, Ordering::SeqCst);
                    gate.wait();
                }
                log.lock().unwrap().push(entry.to_string());
                Ok(PageData::Encoded(page_bytes()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            0,
        );

        service.request_preload_around(0, 3, 0).unwrap();
        // Wait until the worker has taken page 0, so the new window drops only pages 1 to 3;
        // without this it may arrive first and drop the whole first window instead.
        eventually("the worker to park on its first page", || {
            parked.load(Ordering::SeqCst)
        });
        service.request_preload_around(30, 3, 0).unwrap();
        gate.wait();

        // Wait for the queue to drain rather than for a duration: the assertion below is
        // that a page was *never* read, so it has to be made once there is nothing left
        // that could still read it.
        eventually("the queue to drain", || {
            let queue = service.shared.lock();
            queue.jobs.is_empty() && queue.preload.is_empty() && queue.in_flight.is_empty()
        });

        let read = log.lock().unwrap().clone();
        // Page 2 belonged only to the abandoned window, so it must never have been read.
        assert!(
            !read.contains(&names[2]),
            "a superseded window was still read: {read:?}"
        );
        assert!(read.contains(&names[30]));
    }

    #[test]
    fn a_caller_joins_a_read_already_under_way() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));

        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(usize::MAX);
        let reader_reads = reads.clone();
        container.expect_open_reader().returning(move || {
            let reads = reader_reads.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |_| {
                reads.fetch_add(1, Ordering::SeqCst);
                // Long enough that the second caller certainly arrives mid-read.
                thread::sleep(Duration::from_millis(80));
                Ok(PageData::Encoded(page_bytes()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            0,
        ));

        let wanted = names[0].clone();
        let first = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page_blocking(&wanted, Priority::Foreground))
        };
        // Only once the page is genuinely being read does the second caller have anything
        // to join; before that it would simply queue a job of its own.
        eventually("the first read to start", || reading(&service, &wanted));

        let second = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page_blocking(&wanted, Priority::Foreground))
        };

        for caller in [first, second] {
            assert!(caller.join().unwrap().is_ok(), "both callers get the page");
        }
        assert_eq!(
            reads.load(Ordering::SeqCst),
            1,
            "the second caller must attach to the read in flight, not start another"
        );
    }

    #[test]
    fn a_caller_that_joined_a_failing_read_gets_the_same_error() {
        let names = entries(1);
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(|_| {
                thread::sleep(Duration::from_millis(80));
                Err(Error::PathNotFound("the page is gone".to_string()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            0,
        ));

        let wanted = names[0].clone();
        let first = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page_blocking(&wanted, Priority::Foreground))
        };
        eventually("the first read to start", || reading(&service, &wanted));
        let second = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page_blocking(&wanted, Priority::Foreground))
        };

        for caller in [first, second] {
            // The variant is what the frontend maps to a message, so the second caller
            // must see the same one as the first, not a re-rendering of its text.
            assert!(matches!(
                caller.join().unwrap(),
                Err(Error::PathNotFound(_))
            ));
        }
    }

    #[test]
    fn two_workers_popping_one_page_together_read_it_once() {
        let names = entries(3);
        let reads = Arc::new(AtomicUsize::new(0));
        let parked = Arc::new(AtomicUsize::new(0));

        // Two workers, both parked, with two requests for the same third page queued
        // behind them. Releasing both at once is what makes them pop that page
        // concurrently — the one case neither the enqueue-time check nor the cache
        // re-check can catch, because at that moment no read has finished.
        let gate = Arc::new(Barrier::new(3));
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(2usize);
        let reader_gate = gate.clone();
        let reader_reads = reads.clone();
        let reader_parked = parked.clone();
        container.expect_open_reader().returning(move || {
            let gate = reader_gate.clone();
            let reads = reader_reads.clone();
            let parked = reader_parked.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                if entry.ends_with("002.png") {
                    reads.fetch_add(1, Ordering::SeqCst);
                    // Long enough that the other worker certainly pops mid-read.
                    thread::sleep(Duration::from_millis(150));
                } else {
                    parked.fetch_add(1, Ordering::SeqCst);
                    gate.wait();
                }
                Ok(PageData::Encoded(page_bytes()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(service(container));

        let blockers: Vec<_> = names[..2]
            .iter()
            .map(|entry| {
                let service = service.clone();
                let entry = entry.clone();
                thread::spawn(move || service.page_blocking(&entry, Priority::Foreground))
            })
            .collect();
        eventually("both workers to park", || {
            parked.load(Ordering::SeqCst) == 2
        });

        let callers: Vec<_> = (0..2)
            .map(|_| {
                let service = service.clone();
                let wanted = names[2].clone();
                thread::spawn(move || service.page_blocking(&wanted, Priority::Foreground))
            })
            .collect();
        // Both requests are queued now; neither worker can have popped one, because both
        // are parked.
        eventually("both requests to be queued", || queued(&service) == 2);
        gate.wait();

        for blocker in blockers {
            assert!(blocker.join().unwrap().is_ok());
        }
        for caller in callers {
            assert!(caller.join().unwrap().is_ok(), "both callers get the page");
        }
        assert_eq!(
            reads.load(Ordering::SeqCst),
            1,
            "the second worker must attach to the read in flight, not repeat it"
        );
    }

    #[test]
    fn closing_answers_a_caller_blocked_in_dimensions() {
        let names = entries(200);
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_page_dimensions().returning(|_| {
                thread::sleep(Duration::from_millis(20));
                Ok(ImageDimensions {
                    width: 4,
                    height: 2,
                })
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(1000)),
            0,
        ));

        let scanner = {
            let service = service.clone();
            thread::spawn(move || service.dimensions())
        };
        thread::sleep(Duration::from_millis(30));

        // Closing has to answer, not just stop: a caller blocked here holds an `Arc` of
        // its own, so dropping the state's handle would leave it waiting forever.
        service.close();

        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            let _ = done_tx.send(scanner.join().unwrap().is_err());
        });
        assert_eq!(
            done_rx.recv_timeout(Duration::from_secs(10)),
            Ok(true),
            "a scan interrupted by close must report an error rather than hang"
        );

        // And a later request is refused rather than queued against dead workers.
        assert!(matches!(
            service.page_blocking(&names[0], Priority::Foreground),
            Err(Error::BookClosed(_))
        ));
    }

    #[test]
    fn a_page_is_answered_from_the_cache_without_a_read() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));

        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(usize::MAX);
        let reader_reads = reads.clone();
        container.expect_open_reader().returning(move || {
            let reads = reader_reads.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |_| {
                reads.fetch_add(1, Ordering::SeqCst);
                Ok(PageData::Encoded(page_bytes()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = service(container);
        let first = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        let second = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();

        assert_eq!(first.data, second.data);
        assert_eq!(reads.load(Ordering::SeqCst), 1, "the second call hit cache");
        assert!(service.cached(&names[0]).is_some());
    }

    /// A book whose reader serves `bytes` and counts how often the bytes are read.
    fn counting_container_of(
        names: &[String],
        reads: Arc<AtomicUsize>,
        bytes: Vec<u8>,
    ) -> MockContainer {
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.to_vec());
        container.expect_max_readers().return_const(usize::MAX);
        container.expect_open_reader().returning(move || {
            let reads = reads.clone();
            let bytes = bytes.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |_| {
                reads.fetch_add(1, Ordering::SeqCst);
                Ok(PageData::Encoded(bytes.clone()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        container
    }

    /// A book whose reader counts how often the bytes are read.
    fn counting_container(names: &[String], reads: Arc<AtomicUsize>) -> MockContainer {
        counting_container_of(names, reads, page_bytes())
    }

    /// One book, and a reader that counts how often the bytes are read.
    fn counting_service(names: &[String], reads: Arc<AtomicUsize>) -> PageService {
        service(counting_container(names, reads))
    }

    #[test]
    fn a_width_only_resize_serves_the_page_from_the_cache() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let service = counting_service(&names, reads.clone());

        // The 4x2 page is bound by the height in both boxes: 2x1 in each.
        service.set_display_size(Some(Fit {
            width: 100,
            height: 1,
        }));
        let before = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        service.set_display_size(Some(Fit {
            width: 50,
            height: 1,
        }));
        let after = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();

        assert_eq!((after.width, after.height), (2, 1));
        assert_eq!(after.data, before.data);
        assert_eq!(reads.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn the_loupe_is_served_a_viewer_copy_that_came_out_unresized() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let service = counting_service(&names, reads.clone());
        service.set_display_size(Some(Fit {
            width: 8,
            height: 8,
        }));

        let displayed = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        let magnified = service.page_magnified_blocking(&names[0], 2.0).unwrap();

        assert_eq!((displayed.width, displayed.height), (4, 2));
        assert_eq!((magnified.width, magnified.height), (4, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn the_lens_at_zoom_one_is_the_displayed_page() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let service = counting_service(&names, reads.clone());
        service.set_display_size(Some(Fit {
            width: 2,
            height: 2,
        }));

        let displayed = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        let lens = service.page_magnified_blocking(&names[0], 1.0).unwrap();

        assert_eq!(
            (lens.width, lens.height),
            (displayed.width, displayed.height)
        );
        assert_eq!(reads.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn the_lens_is_served_from_the_cache_after_a_width_only_resize() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        // An 8x4 page, so zoom 2 really shrinks it: a box that passed it through whole would
        // answer 8x4 and fail this.
        let service = service(counting_container_of(
            &names,
            reads.clone(),
            page_bytes_sized(8, 4),
        ));

        // Height-bound in both boxes: 4x2 in the lens at zoom 2, either way.
        service.set_display_size(Some(Fit {
            width: 100,
            height: 1,
        }));
        let before = service.page_magnified_blocking(&names[0], 2.0).unwrap();
        service.set_display_size(Some(Fit {
            width: 50,
            height: 1,
        }));
        let after = service.page_magnified_blocking(&names[0], 2.0).unwrap();
        assert_eq!((before.width, before.height), (4, 2));
        assert_eq!((after.width, after.height), (4, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_higher_zoom_reads_the_page_again() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let service = counting_service(&names, reads.clone());
        service.set_display_size(Some(Fit {
            width: 1,
            height: 1,
        }));

        let two = service.page_magnified_blocking(&names[0], 2.0).unwrap();
        let three = service.page_magnified_blocking(&names[0], 3.0).unwrap();
        assert_eq!((two.width, two.height), (2, 1));
        assert_eq!((three.width, three.height), (3, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_preload_window_skips_pages_already_read_at_the_same_size() {
        let recording = crate::perf::capture::record();
        let names = entries(3);
        let service = counting_service(&names, Arc::new(AtomicUsize::new(0)));
        service.set_display_size(Some(Fit {
            width: 100,
            height: 1,
        }));
        for name in &names {
            service.page_blocking(name, Priority::Foreground).unwrap();
        }

        service.set_display_size(Some(Fit {
            width: 50,
            height: 1,
        }));
        service.request_preload_around(0, 2, 0).unwrap();

        // Counted at the skip, not by reads: a queued job would also be answered from the
        // cache by the worker's re-check.
        let lines = recording.lines("preload");
        assert_eq!(lines.len(), 1, "{lines:?}");
        assert!(lines[0].contains(" cached=3 "), "{}", lines[0]);
    }

    #[test]
    fn an_animated_page_read_inside_the_box_is_not_served_shrunk_in_a_smaller_one() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(usize::MAX);
        let reader_reads = reads.clone();
        container.expect_open_reader().returning(move || {
            let reads = reader_reads.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |_| {
                reads.fetch_add(1, Ordering::SeqCst);
                Ok(PageData::Encoded(crate::image::types::tests::animated_gif()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        let service = service(container);

        // Passed through whole, without looking for frames.
        service.set_display_size(Some(Fit {
            width: 8,
            height: 8,
        }));
        service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();

        // The shape seen there predicts a shrunk copy, which an animation never has: a
        // miss, and a read that finds the frames.
        service.set_display_size(Some(Fit {
            width: 2,
            height: 100,
        }));
        let narrow = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        assert_eq!((narrow.width, narrow.height), (4, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 2);

        // Known to be fixed now, so the whole page is served from the cache.
        let again = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        assert_eq!((again.width, again.height), (4, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn the_preview_finds_the_full_page_cached_after_a_width_only_resize() {
        let names = entries(1);
        let log = Arc::new(Mutex::new(Vec::new()));
        // Nothing is gated: no entry is called "none".
        let service = service(gated_container(
            names.clone(),
            "none",
            Arc::new(Barrier::new(1)),
            log.clone(),
        ));
        service.set_display_size(Some(Fit {
            width: 100,
            height: 1,
        }));
        service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();

        service.set_display_size(Some(Fit {
            width: 50,
            height: 1,
        }));
        assert!(service.preview_blocking(&names[0]).unwrap().is_none());
        assert_eq!(*log.lock().unwrap(), vec!["p000.png"]);
    }

    #[test]
    fn a_reopened_book_is_served_from_the_cache_its_last_opening_filled() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let cache = Cache::new(mini_moka::sync::Cache::new(1000));
        let open = || {
            PageService::new(
                "book".to_string(),
                Arc::new(counting_container(&names, reads.clone())),
                pipeline(),
                cache.clone(),
                0,
            )
        };

        let first = open();
        first
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        first.close();
        let second = open();
        second
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();

        assert_eq!(reads.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_page_that_fails_to_decode_is_read_again() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(usize::MAX);
        let reader_reads = reads.clone();
        container.expect_open_reader().returning(move || {
            let reads = reader_reads.clone();
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |_| {
                reads.fetch_add(1, Ordering::SeqCst);
                Ok(PageData::Encoded(b"not an image".to_vec()))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        let service = service(container);

        assert!(service
            .page_blocking(&names[0], Priority::Foreground)
            .is_err());
        assert!(service
            .page_blocking(&names[0], Priority::Foreground)
            .is_err());
        assert_eq!(reads.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_page_is_cached_once_per_viewport() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let service = counting_service(&names, reads.clone());

        assert!(service.set_display_size(Some(Fit {
            width: 2,
            height: 2
        })));
        let small = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        assert_eq!((small.width, small.height), (2, 1));

        // The reader resized the window. The page cached for the old one is not the page
        // they would be shown, so it must not be served for the new one.
        assert!(service.set_display_size(Some(Fit {
            width: 4,
            height: 4
        })));
        assert!(
            service.cached(&names[0]).is_none(),
            "the fit is part of the cache key"
        );
        let large = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        assert_eq!((large.width, large.height), (4, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 2);

        // Both are kept, so going back to a size the window has been is a cache hit.
        assert!(service.set_display_size(Some(Fit {
            width: 2,
            height: 2
        })));
        assert!(service.cached(&names[0]).is_some());
        assert_eq!(reads.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn reporting_the_same_viewport_twice_changes_nothing() {
        let names = entries(1);
        let service = counting_service(&names, Arc::new(AtomicUsize::new(0)));
        let size = Some(Fit {
            width: 2,
            height: 2,
        });

        assert!(service.set_display_size(size));
        // The frontend reports on every resize, and the viewer drops its rendered pages
        // whenever this says the size moved.
        assert!(!service.set_display_size(size));
    }

    #[test]
    fn the_loupe_reads_a_page_the_viewport_does_not_bound() {
        let names = entries(1);
        let reads = Arc::new(AtomicUsize::new(0));
        let service = counting_service(&names, reads.clone());
        service.set_display_size(Some(Fit {
            width: 2,
            height: 2,
        }));

        let displayed = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        let magnified = service.page_magnified_blocking(&names[0], 2.0).unwrap();

        // Magnifying the fitted page would only upscale what is already on screen.
        assert_eq!((displayed.width, displayed.height), (2, 1));
        assert_eq!((magnified.width, magnified.height), (4, 2));
        assert_eq!(reads.load(Ordering::SeqCst), 2, "two different reads");
    }

    #[test]
    fn a_decoded_page_is_fitted_for_the_viewer_and_for_the_lens() {
        let names = entries(1);
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(|_| {
                Ok(PageData::Decoded(image::DynamicImage::ImageRgb8(
                    image::RgbImage::new(8, 4),
                )))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        let service = service(container);
        service.set_display_size(Some(Fit {
            width: 2,
            height: 2,
        }));

        let displayed = service
            .page_blocking(&names[0], Priority::Foreground)
            .unwrap();
        let zoomed = service.page_magnified_blocking(&names[0], 2.0).unwrap();
        let whole = service.page_magnified_blocking(&names[0], 100.0).unwrap();

        assert_eq!((displayed.width, displayed.height), (2, 1));
        assert_eq!((zoomed.width, zoomed.height), (4, 2));
        assert_eq!((whole.width, whole.height), (8, 4));
        for image in [&displayed, &zoomed, &whole] {
            assert_eq!(
                image::guess_format(&image.data).unwrap(),
                image::ImageFormat::Png
            );
        }
    }

    #[test]
    fn a_decoded_preview_is_fitted_to_the_preview_contract() {
        let names = entries(1);
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_read_preview().returning(|_| {
                Ok(Some(PageData::Decoded(image::DynamicImage::ImageRgb8(
                    image::RgbImage::new(1200, 600),
                ))))
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        let service = service(container);

        let preview = service
            .preview_blocking(&names[0])
            .unwrap()
            .expect("a preview");

        assert_eq!(
            image::guess_format(&preview.data).unwrap(),
            image::ImageFormat::Jpeg
        );
        assert_eq!(
            (preview.width, preview.height),
            (PREVIEW.max_size, PREVIEW.max_size / 2)
        );
    }

    #[test]
    fn an_unknown_entry_is_refused_rather_than_queued() {
        let names = entries(2);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(names.clone(), 1, log));

        // A book with no entries starts no workers at all, so a job for one would never
        // be popped; the entry lookup is what keeps a caller from blocking forever.
        assert!(service
            .page_blocking("absent.png", Priority::Foreground)
            .is_err());
        assert!(service.preview_blocking("absent.png").is_err());
    }

    #[test]
    fn one_unmeasurable_page_does_not_fail_the_scan() {
        let names = entries(4);
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        container.expect_open_reader().returning(|| {
            let mut reader = MockPageReader::new();
            reader.expect_page_dimensions().returning(|entry| {
                if entry.ends_with("002.png") {
                    Err(Error::Other("unreadable".to_string()))
                } else {
                    Ok(ImageDimensions {
                        width: 4,
                        height: 2,
                    })
                }
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        // The viewer holds its layout until this scan lands, so failing the whole scan
        // would cost the book its two-page view over one bad page.
        let service = Arc::new(service(container));
        let _watch = close_if_stuck(&service);
        let measured = service.dimensions().unwrap();
        assert_eq!(measured.len(), 4);
        assert_eq!(
            measured[2],
            ImageDimensions {
                width: 0,
                height: 0
            },
            "an unmeasurable page reads as portrait, the shape an unknown page gets anyway"
        );
        assert_eq!(
            measured[3],
            ImageDimensions {
                width: 4,
                height: 2
            }
        );
    }

    #[test]
    fn a_scan_is_one_record_however_many_pages_it_measures() {
        let recording = crate::perf::capture::record();
        let names = entries(40);
        let log = Arc::new(Mutex::new(Vec::new()));

        let service = Arc::new(service(recording_container(names.clone(), 1, log)));
        let _watch = close_if_stuck(&service);
        let measured = service.dimensions().unwrap();
        assert_eq!(measured.len(), 40);

        // Forty pages, one line. A record per page would cost more in log I/O than the
        // scan costs in work, and would bury every other record in the file.
        let lines = recording.lines("scan");
        assert_eq!(lines.len(), 1, "{lines:?}");
        assert!(lines[0].contains(" pages=40 failed=0 ms="), "{}", lines[0]);
    }

    #[tokio::test]
    async fn a_page_record_says_which_of_the_three_it_was() {
        let recording = crate::perf::capture::record();
        let names = entries(2);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(recording_container(names.clone(), 1, log)));
        let _watch = close_if_stuck(&service);

        // The record is written by the async read, which is what the commands use.
        service
            .page(&names[0], Priority::Foreground, None)
            .await
            .unwrap();
        service
            .page(&names[0], Priority::Foreground, None)
            .await
            .unwrap();

        // A duration is unreadable without this: the second call is fast because it never
        // left the cache, not because the archive got quicker.
        let lines = recording.lines("page");
        assert_eq!(lines.len(), 2, "{lines:?}");
        assert!(lines[0].contains(" source=read "), "{}", lines[0]);
        assert!(lines[1].contains(" source=cache "), "{}", lines[1]);
    }

    #[test]
    fn a_novel_measures_nothing_and_blocks_nobody() {
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(Vec::new());
        container.expect_max_readers().return_const(usize::MAX);

        let service = PageService::new(
            "novel".to_string(),
            Arc::new(container),
            pipeline(),
            Cache::new(mini_moka::sync::Cache::new(100)),
            0,
        );

        assert_eq!(service.dimensions().unwrap(), Vec::new());
        service.request_preload_around(0, 5, 0).unwrap();
        assert!(service
            .page_blocking("anything", Priority::Foreground)
            .is_err());
    }

    #[test]
    #[should_panic(expected = "the job was never run")]
    fn a_reply_that_never_comes_fails_the_test() {
        // The sender is kept alive, so the receiver neither gets a value nor sees it closed.
        let (_tx, rx) = oneshot::channel::<Result<()>>();
        let _ = reply_within(rx, Duration::from_millis(50));
    }

    fn gated_container(
        names: Vec<String>,
        gated: &str,
        gate: Arc<Barrier>,
        log: Arc<Mutex<Vec<String>>>,
    ) -> MockContainer {
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names);
        container.expect_max_readers().return_const(1usize);
        let gated = gated.to_string();
        container.expect_open_reader().returning(move || {
            let gate = gate.clone();
            let gated = gated.clone();
            let read_log = log.clone();
            let preview_log = log.clone();
            let first = Arc::new(AtomicBool::new(true));
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                read_log.lock().unwrap().push(entry.to_string());
                if entry == gated && first.swap(false, Ordering::SeqCst) {
                    gate.wait();
                }
                Ok(PageData::Encoded(page_bytes()))
            });
            reader.expect_read_preview().returning(move |entry| {
                preview_log.lock().unwrap().push(format!("preview:{entry}"));
                Ok(None)
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });
        container
    }

    /// A one-worker book parked on its first page, with the rest of it queued as preload.
    fn parked_with_preload(
        gate: Arc<Barrier>,
    ) -> (Arc<PageService>, thread::JoinHandle<Result<Arc<Image>>>) {
        let names = entries(4);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate,
            log,
        )));
        service.set_display_size(Some(Fit {
            width: 8,
            height: 8,
        }));
        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));
        service.request_preload_around(0, 3, 1).unwrap();
        assert_eq!(service.shared.lock().preload.len(), 3);
        (service, parked)
    }

    #[test]
    fn a_viewport_change_drops_the_queued_preload() {
        let gate = Arc::new(Barrier::new(2));
        let (service, parked) = parked_with_preload(gate.clone());

        assert!(service.set_display_size(Some(Fit {
            width: 6,
            height: 8
        })));
        assert_eq!(service.shared.lock().preload.len(), 0);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
    }

    #[test]
    fn reporting_the_same_viewport_keeps_the_queued_preload() {
        let gate = Arc::new(Barrier::new(2));
        let (service, parked) = parked_with_preload(gate.clone());

        assert!(!service.set_display_size(Some(Fit {
            width: 8,
            height: 8
        })));
        assert_eq!(service.shared.lock().preload.len(), 3);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
    }

    fn latest(service: &PageService) -> u64 {
        service.shared.lock().latest_generation
    }

    fn joined(service: &PageService, entry: &str) -> usize {
        let fit = service.shared.pipeline().fit();
        service
            .shared
            .lock()
            .in_flight
            .get(&(entry.to_string(), fit))
            .map_or(0, Vec::len)
    }

    #[test]
    fn a_newer_generation_cancels_the_pages_it_supersedes() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log.clone(),
        )));

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let mut callers = Vec::new();
        for (i, name) in names.iter().enumerate().take(51).skip(10) {
            let service_for_thread = service.clone();
            let entry = name.clone();
            callers.push(thread::spawn(move || {
                service_for_thread.page_blocking_in(&entry, i as u64)
            }));
            eventually("generation to advance with one queued job", || {
                latest(&service) == i as u64 && queued(&service) == 1
            });
        }

        gate.wait();
        assert!(parked.join().unwrap().is_ok());

        let last = callers.pop().unwrap();
        for caller in callers {
            assert!(matches!(
                caller.join().unwrap(),
                Err(Error::RequestCancelled(_))
            ));
        }
        assert!(last.join().unwrap().is_ok());
        assert_eq!(*log.lock().unwrap(), vec!["p000.png", "p050.png"]);
    }

    #[test]
    fn a_queued_preview_is_cancelled_and_a_stale_one_refused() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log.clone(),
        )));

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let preview = {
            let service = service.clone();
            let entry = names[1].clone();
            thread::spawn(move || service.preview_blocking_in(&entry, 2))
        };
        eventually("preview to queue", || queued(&service) == 1);

        let page = {
            let service = service.clone();
            let entry = names[2].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 3))
        };
        eventually("newer page to queue", || {
            latest(&service) == 3 && queued(&service) == 1
        });

        assert!(matches!(
            preview.join().unwrap(),
            Err(Error::RequestCancelled(_))
        ));
        assert!(matches!(
            service.preview_blocking_in(&names[3], 2),
            Err(Error::RequestCancelled(_))
        ));
        assert_eq!(queued(&service), 1);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
        assert!(page.join().unwrap().is_ok());
        assert_eq!(*log.lock().unwrap(), vec!["p000.png", "p002.png"]);
    }

    #[test]
    fn an_older_generation_is_refused_at_once() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log,
        )));

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let newer = {
            let service = service.clone();
            let entry = names[5].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 5))
        };
        eventually("p005 to queue", || queued(&service) == 1);

        assert!(matches!(
            service.page_blocking_in(&names[4], 4),
            Err(Error::RequestCancelled(_))
        ));
        assert_eq!(queued(&service), 1);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
        assert!(newer.join().unwrap().is_ok());
    }

    #[test]
    fn a_cached_page_still_advances_the_generation() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log,
        )));

        assert!(service.page_blocking_in(&names[1], 1).is_ok());

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let queued_page = {
            let service = service.clone();
            let entry = names[2].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 2))
        };
        eventually("p002 to queue", || queued(&service) == 1);

        assert!(service.page_blocking_in(&names[1], 3).is_ok());
        assert!(matches!(
            queued_page.join().unwrap(),
            Err(Error::RequestCancelled(_))
        ));
        assert!(matches!(
            service.page_blocking_in(&names[1], 2),
            Err(Error::RequestCancelled(_))
        ));
        assert!(matches!(
            service.preview_blocking_in(&names[1], 2),
            Err(Error::RequestCancelled(_))
        ));

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
    }

    #[test]
    fn joining_a_running_read_still_cancels_older_pages_and_keeps_its_waiters() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log.clone(),
        )));

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking_in(&first, 1))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let stale = {
            let service = service.clone();
            let entry = names[1].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 1))
        };
        eventually("p001 to queue", || queued(&service) == 1);

        let joiner = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking_in(&first, 2))
        };
        eventually("joiner to attach to p000", || {
            joined(&service, &names[0]) == 1
        });
        // Joining at generation 2 itself cancels p001 before generation 3 arrives.
        assert!(matches!(
            stale.join().unwrap(),
            Err(Error::RequestCancelled(_))
        ));
        assert_eq!(queued(&service), 0);

        let newest = {
            let service = service.clone();
            let entry = names[2].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 3))
        };
        eventually("p002 to queue", || queued(&service) == 1);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
        assert!(joiner.join().unwrap().is_ok());
        assert!(newest.join().unwrap().is_ok());
        assert_eq!(*log.lock().unwrap(), vec!["p000.png", "p002.png"]);
    }

    #[test]
    fn one_generation_keeps_its_pages_and_reads_each_preview_first() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log.clone(),
        )));

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let p1 = {
            let service = service.clone();
            let entry = names[1].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 7))
        };
        let p2 = {
            let service = service.clone();
            let entry = names[2].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 7))
        };
        eventually("both pages to queue", || queued(&service) == 2);

        let prev1 = {
            let service = service.clone();
            let entry = names[1].clone();
            thread::spawn(move || service.preview_blocking_in(&entry, 7))
        };
        let prev2 = {
            let service = service.clone();
            let entry = names[2].clone();
            thread::spawn(move || service.preview_blocking_in(&entry, 7))
        };
        eventually("both previews to queue", || queued(&service) == 4);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
        assert!(p1.join().unwrap().is_ok());
        assert!(p2.join().unwrap().is_ok());
        assert!(prev1.join().unwrap().is_ok());
        assert!(prev2.join().unwrap().is_ok());
        assert_eq!(
            *log.lock().unwrap(),
            vec![
                "p000.png",
                "preview:p001.png",
                "p001.png",
                "preview:p002.png",
                "p002.png",
            ]
        );
    }

    #[test]
    fn a_newer_generation_leaves_the_loupe_alone() {
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log.clone(),
        )));

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        let loupe = {
            let service = service.clone();
            let entry = names[1].clone();
            thread::spawn(move || service.page_magnified_blocking(&entry, 2.0))
        };
        eventually("loupe request to queue", || queued(&service) == 1);

        let newer = {
            let service = service.clone();
            let entry = names[2].clone();
            thread::spawn(move || service.page_blocking_in(&entry, 9))
        };
        eventually("both requests to stay queued", || queued(&service) == 2);

        gate.wait();
        assert!(parked.join().unwrap().is_ok());
        assert!(loupe.join().unwrap().is_ok());
        assert!(newer.join().unwrap().is_ok());
        assert!(log.lock().unwrap().contains(&names[1]));
    }

    #[tokio::test]
    async fn a_cancelled_request_is_recorded_as_cancelled() {
        let recording = crate::perf::capture::record();
        let names = entries(51);
        let gate = Arc::new(Barrier::new(2));
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = Arc::new(service(gated_container(
            names.clone(),
            &names[0],
            gate.clone(),
            log,
        )));
        let _watch = close_if_stuck(&service);

        // Prime p001 into the cache so later generations can cancel via cache hit.
        service
            .page(&names[1], Priority::Foreground, Some(1))
            .await
            .unwrap();

        let parked = {
            let service = service.clone();
            let first = names[0].clone();
            thread::spawn(move || service.page_blocking(&first, Priority::Foreground))
        };
        eventually("worker to park on p000", || reading(&service, &names[0]));

        // Page cancelled while queued.
        let (queued_page, cache_hit) = tokio::join!(
            service.page(&names[2], Priority::Foreground, Some(2)),
            async {
                while queued(&service) == 0 && !service.shared.lock().closed {
                    tokio::task::yield_now().await;
                }
                service.page(&names[1], Priority::Foreground, Some(3)).await
            }
        );
        assert!(matches!(queued_page, Err(Error::RequestCancelled(_))));
        assert!(cache_hit.is_ok());

        // Preview cancelled while queued.
        let (queued_preview, cache_hit) =
            tokio::join!(service.preview(&names[3], Some(4)), async {
                while queued(&service) == 0 && !service.shared.lock().closed {
                    tokio::task::yield_now().await;
                }
                service.page(&names[1], Priority::Foreground, Some(5)).await
            });
        assert!(matches!(queued_preview, Err(Error::RequestCancelled(_))));
        assert!(cache_hit.is_ok());

        // Refused at once.
        assert!(matches!(
            service.page(&names[4], Priority::Foreground, Some(1)).await,
            Err(Error::RequestCancelled(_))
        ));
        assert!(matches!(
            service.preview(&names[4], Some(1)).await,
            Err(Error::RequestCancelled(_))
        ));

        gate.wait();
        assert!(parked.join().unwrap().is_ok());

        let cancelled_pages = recording
            .lines("page")
            .into_iter()
            .filter(|line| line.contains(" source=cancelled"))
            .count();
        let cancelled_previews = recording
            .lines("preview")
            .into_iter()
            .filter(|line| line.contains(" source=cancelled"))
            .count();
        assert_eq!(cancelled_pages, 2);
        assert_eq!(cancelled_previews, 2);
    }
}
