//! One scheduler for one open book: every reader thread and one priority queue.
//!
//! A format decides how to read a page; it does not decide when, in what order, or on how
//! many threads. Those are decided here, once, for every format — which is what keeps a
//! new format from having to choose between locking a shared handle and rebuilding one
//! per call.

use std::{
    cmp::{max, Ordering},
    collections::{hash_map::Entry, BinaryHeap, HashMap},
    sync::{mpsc, Arc, Condvar, Mutex, MutexGuard, RwLock},
    thread,
};

use crate::{
    container::traits::{Container, PageReader},
    error::{Error, Result},
    image::types::{Image, ImageDimensions},
    page::{
        cache::{Cache, CacheKey},
        pipeline::Pipeline,
    },
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
    /// The current page and the pages after it.
    PreloadAhead,
    /// The pages before the current one.
    PreloadBehind,
    /// Measuring every page of the book.
    Scan,
}

impl Priority {
    /// Whether a queued job of this class is dropped when a new preload window arrives.
    fn is_preload(self) -> bool {
        matches!(self, Priority::PreloadAhead | Priority::PreloadBehind)
    }
}

/// Where a finished job's result goes.
enum Reply {
    Page(mpsc::Sender<Result<Arc<Image>>>),
    /// One sender shared by a whole scan. The index rides along because replies arrive in
    /// completion order and [`PageService::dimensions`] has to return them in entry order.
    Dimensions(usize, mpsc::Sender<(usize, Result<ImageDimensions>)>),
    Preview(mpsc::Sender<Result<Option<Arc<Image>>>>),
    /// Preload: the result only has to reach the cache.
    None,
}

/// One page of work.
struct Job {
    priority: Priority,
    /// `(entry index, 0 for a preview and 1 for a page)`. The second element only matters
    /// on an exclusive backend, where serving a page's cheap preview before its full
    /// render is what puts something on screen early.
    order: (usize, u8),
    entry: String,
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
    jobs: BinaryHeap<Job>,
    /// Entries a worker is currently reading, and the callers waiting on each. A request
    /// for a page another worker has already picked up attaches here instead of reading
    /// it a second time.
    in_flight: HashMap<String, Vec<mpsc::Sender<Result<Arc<Image>>>>>,
    closed: bool,
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
    pipeline: Pipeline,
}

impl Shared {
    /// Locks the queue, recovering a poisoned lock rather than propagating it: a worker
    /// that panicked mid-job leaves no broken invariant behind, only a missing answer,
    /// and the caller waiting on it is already about to see a closed channel.
    fn lock(&self) -> MutexGuard<'_, Queue> {
        self.queue.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn key(&self, entry: &str) -> CacheKey {
        CacheKey {
            book_id: self.book_id.clone(),
            entry: entry.to_string(),
        }
    }

    fn cached(&self, entry: &str) -> Option<Arc<Image>> {
        self.cache
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get(&self.key(entry))
    }

    fn store(&self, entry: &str, image: Arc<Image>) {
        self.cache
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .insert(self.key(entry), image);
    }
}

/// The error every blocked caller gets once its book is closed.
fn closed() -> Error {
    Error::Other("The book was closed while a page was being read".to_string())
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
    pub fn new(
        book_id: String,
        container: Arc<dyn Container>,
        pipeline: Pipeline,
        cache: Cache,
    ) -> Self {
        let order: HashMap<String, usize> = container
            .get_entries()
            .iter()
            .enumerate()
            .map(|(index, entry)| (entry.clone(), index))
            .collect();

        let shared = Arc::new(Shared {
            book_id,
            queue: Mutex::new(Queue {
                jobs: BinaryHeap::new(),
                in_flight: HashMap::new(),
                closed: false,
            }),
            wake: Condvar::new(),
            cache: RwLock::new(cache),
            pipeline,
        });

        let workers = if order.is_empty() {
            0
        } else {
            let cores = thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
            container.max_readers().min(max(1, cores / 2))
        };

        for index in 0..workers {
            let shared = shared.clone();
            let container = container.clone();
            // Detached on purpose. Teardown must never join: `close` is called from
            // `ContainerState` under the state write lock, and waiting there for a worker
            // to finish a page would hold every command behind an in-flight read.
            let spawned = thread::Builder::new()
                .name(format!("page-reader-{index}"))
                .spawn(move || worker(shared, container));
            if let Err(e) = spawned {
                log::error!("Failed to start a page reader thread: {e}");
            }
        }

        Self {
            container,
            order,
            shared,
        }
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

    /// Reads one page, waiting for it.
    ///
    /// Cache first; only a miss reaches the queue. Blocking, so callers stay on
    /// `spawn_blocking` exactly as they do today.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry is not part of this book, the book is closed while
    /// the page is being read, or the page cannot be read or decoded.
    pub fn page(&self, entry: &str, priority: Priority) -> Result<Arc<Image>> {
        if let Some(image) = self.shared.cached(entry) {
            log::debug!("Hit cache: {entry}");
            return Ok(image);
        }

        let index = self.index_of(entry)?;
        let (tx, rx) = mpsc::channel();
        {
            let mut queue = self.shared.lock();
            if queue.closed {
                return Err(closed());
            }
            match queue.in_flight.entry(entry.to_string()) {
                // A worker already has this page open; wait on its result rather than
                // reading the same bytes twice.
                Entry::Occupied(mut waiting) => waiting.get_mut().push(tx),
                Entry::Vacant(_) => queue.jobs.push(Job {
                    priority,
                    order: (index, 1),
                    entry: entry.to_string(),
                    reply: Reply::Page(tx),
                }),
            }
        }
        self.shared.wake.notify_one();

        rx.recv().map_err(|_| closed())?
    }

    /// Reads a small stand-in for one page, if its format has a cheaper path to one.
    ///
    /// Ordered before the same entry's page, because the frontend only asks for previews
    /// of the pages it is displaying right now.
    ///
    /// # Returns
    ///
    /// `Ok(None)` when the full page is already cached, or the format has no preview.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry is not part of this book, the book is closed, or the
    /// preview cannot be produced.
    pub fn preview(&self, entry: &str) -> Result<Option<Arc<Image>>> {
        if self.shared.cached(entry).is_some() {
            log::debug!("Skip create the thumbnail. Hit cache: {entry}");
            return Ok(None);
        }

        let index = self.index_of(entry)?;
        let (tx, rx) = mpsc::channel();
        {
            let mut queue = self.shared.lock();
            if queue.closed {
                return Err(closed());
            }
            queue.jobs.push(Job {
                priority: Priority::Foreground,
                order: (index, 0),
                entry: entry.to_string(),
                reply: Reply::Preview(tx),
            });
        }
        self.shared.wake.notify_one();

        rx.recv().map_err(|_| closed())?
    }

    /// Enqueues the window around `center`, skipping entries already cached.
    ///
    /// `center..=center + buffer` goes in as [`Priority::PreloadAhead`] and
    /// `center - buffer..center` as [`Priority::PreloadBehind`], both in ascending entry
    /// order.
    ///
    /// Un-started preload jobs from the previous window are dropped first: the frontend
    /// calls this on every page turn, and a window the reader has left must not outrank
    /// the one they are in. A job a worker has already picked up still finishes. This
    /// replaces the old generation counter; book switches are cancelled by
    /// [`PageService::close`].
    pub fn request_preload_around(&self, center: usize, buffer: usize) -> Result<()> {
        let entries = self.container.get_entries();
        if entries.is_empty() {
            return Ok(());
        }

        let start = center.saturating_sub(buffer);
        let end = (center + buffer + 1).min(entries.len());
        let ahead = center.min(entries.len())..end;
        let behind = start..center.min(entries.len());

        let mut queue = self.shared.lock();
        if queue.closed {
            return Ok(());
        }
        queue.jobs.retain(|job| !job.priority.is_preload());

        for (range, priority) in [
            (ahead, Priority::PreloadAhead),
            (behind, Priority::PreloadBehind),
        ] {
            for index in range {
                let entry = &entries[index];
                if self.shared.cached(entry).is_some() {
                    continue;
                }
                queue.jobs.push(Job {
                    priority,
                    order: (index, 1),
                    entry: entry.clone(),
                    reply: Reply::None,
                });
            }
        }
        drop(queue);
        self.shared.wake.notify_all();

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
                    reply: Reply::Dimensions(index, tx.clone()),
                });
            }
        }
        // The queue holds the only remaining senders, so `recv` reports a closed book
        // instead of blocking once `close` has dropped them.
        drop(tx);
        self.shared.wake.notify_all();

        let mut measured: Vec<Option<ImageDimensions>> = vec![None; entries.len()];
        for _ in 0..entries.len() {
            let (index, result) = rx.recv().map_err(|_| closed())?;
            measured[index] = Some(result?);
        }

        measured
            .into_iter()
            .map(|dimensions| dimensions.ok_or_else(closed))
            .collect()
    }

    /// Reads one page straight from the cache, without queuing anything.
    pub fn cached(&self, entry: &str) -> Option<Arc<Image>> {
        self.shared.cached(entry)
    }

    /// Drops every queued job, closes the queue and lets the workers exit.
    ///
    /// Idempotent, takes `&self`, and answers blocked callers with an error rather than
    /// leaving them waiting: dropping the queued jobs drops the senders they carry, which
    /// is what wakes a `recv`. It never joins a worker, so a caller may close a book
    /// while a page is still being read.
    pub fn close(&self) {
        {
            let mut queue = self.shared.lock();
            queue.closed = true;
            queue.jobs.clear();
            queue.in_flight.clear();
        }
        self.shared.wake.notify_all();
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

/// One reader thread's whole life.
fn worker(shared: Arc<Shared>, container: Arc<dyn Container>) {
    let mut reader: Option<Box<dyn PageReader>> = None;

    loop {
        let Some(job) = next_job(&shared) else { return };

        // Another worker may have cached this page between the enqueue and this pop.
        // Answer from the cache rather than skipping the job: skipping would drop
        // `job.reply` with it, and a caller blocked in `page()` would see a closed
        // channel — a spurious failure on what is in fact a cache hit.
        if job.reads_the_page() {
            if let Some(image) = shared.cached(&job.entry) {
                deliver_page(&shared, &job, Ok(image));
                continue;
            }
        }

        // Opened on the first job rather than at construction, so a book closed straight
        // after opening never pays for an archive handle it will not use.
        if reader.is_none() {
            match container.open_reader() {
                Ok(opened) => reader = Some(opened),
                Err(e) => {
                    let message = e.to_string();
                    deliver_error(&shared, &job, &message);
                    // The handle will not appear on a retry, so leave rather than fail
                    // every remaining job one at a time.
                    log::error!("Failed to open a page reader: {message}");
                    return;
                }
            }
        }
        let Some(reader) = reader.as_mut() else {
            return;
        };

        run(&shared, reader.as_mut(), job);
    }
}

/// Pops the next job, registering a page read in `in_flight` before releasing the lock.
///
/// The lock is never held across a read, a decode or a resize: holding it there is
/// exactly the mistake that makes an un-restructured ZIP scan block page 0 for half a
/// second. Returns `None` once the book is closed.
fn next_job(shared: &Shared) -> Option<Job> {
    let mut queue = shared.lock();
    loop {
        if queue.closed {
            return None;
        }
        if let Some(job) = queue.jobs.pop() {
            if !job.reads_the_page() {
                return Some(job);
            }
            match queue.in_flight.entry(job.entry.clone()) {
                // Two callers asked for the same page before either was picked up. Wait
                // on the one that is running instead of reading the bytes twice.
                Entry::Occupied(mut waiting) => {
                    if let Reply::Page(tx) = job.reply {
                        waiting.get_mut().push(tx);
                    }
                }
                Entry::Vacant(slot) => {
                    slot.insert(Vec::new());
                    return Some(job);
                }
            }
            continue;
        }
        queue = shared
            .wake
            .wait(queue)
            .unwrap_or_else(|poisoned| poisoned.into_inner());
    }
}

/// Runs one job and answers everyone waiting on it.
fn run(shared: &Shared, reader: &mut dyn PageReader, job: Job) {
    match &job.reply {
        Reply::Dimensions(index, tx) => {
            let _ = tx.send((*index, reader.page_dimensions(&job.entry)));
        }
        Reply::Preview(tx) => {
            let preview = reader.read_preview(&job.entry).and_then(|bytes| {
                bytes.map(|bytes| shared.pipeline.preview(bytes)).transpose()
            });
            let _ = tx.send(preview);
        }
        Reply::Page(_) | Reply::None => {
            let page = reader
                .read_page(&job.entry)
                .and_then(|bytes| shared.pipeline.page(bytes));
            if let Ok(image) = &page {
                shared.store(&job.entry, image.clone());
            }
            deliver_page(shared, &job, page);
        }
    }
}

/// Sends a page result to the job's own caller and to everyone who attached to it.
///
/// `Error` is not `Clone` — several of its variants wrap foreign error types that are not
/// — so a failure shared by more than one caller is re-rendered as its message. Which
/// page failed is reported either way; only the exact variant is lost, and only for the
/// second and later callers waiting on a single read.
fn deliver_page(shared: &Shared, job: &Job, result: Result<Arc<Image>>) {
    let waiting = shared
        .lock()
        .in_flight
        .remove(&job.entry)
        .unwrap_or_default();

    match result {
        Ok(image) => {
            if let Reply::Page(tx) = &job.reply {
                let _ = tx.send(Ok(image.clone()));
            }
            for tx in waiting {
                let _ = tx.send(Ok(image.clone()));
            }
        }
        Err(e) => {
            let message = e.to_string();
            if let Reply::Page(tx) = &job.reply {
                let _ = tx.send(Err(e));
            }
            for tx in waiting {
                let _ = tx.send(Err(Error::Other(message.clone())));
            }
        }
    }
}

/// Fails one job, and anything attached to it, without having read anything.
fn deliver_error(shared: &Shared, job: &Job, message: &str) {
    match &job.reply {
        Reply::Dimensions(index, tx) => {
            let _ = tx.send((*index, Err(Error::Other(message.to_string()))));
        }
        Reply::Preview(tx) => {
            let _ = tx.send(Err(Error::Other(message.to_string())));
        }
        Reply::Page(_) | Reply::None => {
            deliver_page(shared, job, Err(Error::Other(message.to_string())));
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        io::Cursor,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Barrier,
        },
        time::Duration,
    };

    use crate::{
        container::traits::{MockContainer, MockPageReader},
        image::resizer::ResizeFilter,
    };

    use super::*;

    /// A real 4x2 PNG. Pages travel as encoded bytes and are decoded by the pipeline.
    fn page_bytes() -> Vec<u8> {
        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
            .expect("failed to encode the page fixture");
        buffer
    }

    fn entries(count: usize) -> Vec<String> {
        (0..count).map(|index| format!("p{index:03}.png")).collect()
    }

    fn pipeline() -> Pipeline {
        Pipeline {
            max_image_height: 0,
            resize_method: ResizeFilter::Bilinear,
        }
    }

    fn service(container: MockContainer) -> PageService {
        PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            mini_moka::sync::Cache::new(1000),
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
                Ok(page_bytes())
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
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(service(container));
        let scanner = {
            let service = service.clone();
            thread::spawn(move || service.dimensions())
        };

        // The last page of the book, so entry order cannot be what puts it early.
        let wanted = names[7].clone();
        let foreground = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page(&wanted, Priority::Foreground))
        };
        eventually("the scan to park on its first page", || {
            !log.lock().unwrap().is_empty()
        });
        thread::sleep(Duration::from_millis(50));

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

        service.request_preload_around(5, 2).unwrap();
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
    fn a_new_window_discards_the_pages_the_reader_has_left() {
        let names = entries(40);
        let log = Arc::new(Mutex::new(Vec::new()));

        // One worker, held on its first page until the second window has been requested.
        let gate = Arc::new(Barrier::new(2));
        let mut container = MockContainer::new();
        container.expect_get_entries().return_const(names.clone());
        container.expect_max_readers().return_const(1usize);
        let reader_gate = gate.clone();
        let reader_log = log.clone();
        container.expect_open_reader().returning(move || {
            let gate = reader_gate.clone();
            let log = reader_log.clone();
            let first = Arc::new(AtomicUsize::new(0));
            let mut reader = MockPageReader::new();
            reader.expect_read_page().returning(move |entry| {
                if first.fetch_add(1, Ordering::SeqCst) == 0 {
                    gate.wait();
                }
                log.lock().unwrap().push(entry.to_string());
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            mini_moka::sync::Cache::new(1000),
        );

        service.request_preload_around(0, 3).unwrap();
        // The worker is now parked inside the first window's first page.
        service.request_preload_around(30, 3).unwrap();
        gate.wait();

        eventually("the second window to be read", || {
            log.lock().unwrap().len() >= 7
        });
        thread::sleep(Duration::from_millis(50));

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
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            mini_moka::sync::Cache::new(1000),
        ));

        let wanted = names[0].clone();
        let callers: Vec<_> = (0..2)
            .map(|_| {
                let service = service.clone();
                let wanted = wanted.clone();
                thread::spawn(move || service.page(&wanted, Priority::Foreground))
            })
            .collect();

        for caller in callers {
            assert!(caller.join().unwrap().is_ok(), "both callers get the page");
        }
        assert_eq!(
            reads.load(Ordering::SeqCst),
            1,
            "the second caller must attach to the read in flight, not start another"
        );
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
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(service(container));

        let blockers: Vec<_> = names[..2]
            .iter()
            .map(|entry| {
                let service = service.clone();
                let entry = entry.clone();
                thread::spawn(move || service.page(&entry, Priority::Foreground))
            })
            .collect();
        eventually("both workers to park", || parked.load(Ordering::SeqCst) == 2);

        let callers: Vec<_> = (0..2)
            .map(|_| {
                let service = service.clone();
                let wanted = names[2].clone();
                thread::spawn(move || service.page(&wanted, Priority::Foreground))
            })
            .collect();
        // Both requests are queued now; neither worker can have popped one yet.
        thread::sleep(Duration::from_millis(50));
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
            mini_moka::sync::Cache::new(1000),
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
        assert!(service.page(&names[0], Priority::Foreground).is_err());
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
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = service(container);
        let first = service.page(&names[0], Priority::Foreground).unwrap();
        let second = service.page(&names[0], Priority::Foreground).unwrap();

        assert_eq!(first.data, second.data);
        assert_eq!(reads.load(Ordering::SeqCst), 1, "the second call hit cache");
        assert!(service.cached(&names[0]).is_some());
    }

    #[test]
    fn an_unknown_entry_is_refused_rather_than_queued() {
        let names = entries(2);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(names.clone(), 1, log));

        // A book with no entries starts no workers at all, so a job for one would never
        // be popped; the entry lookup is what keeps a caller from blocking forever.
        assert!(service.page("absent.png", Priority::Foreground).is_err());
        assert!(service.preview("absent.png").is_err());
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
            mini_moka::sync::Cache::new(100),
        );

        assert_eq!(service.dimensions().unwrap(), Vec::new());
        service.request_preload_around(0, 5).unwrap();
        assert!(service.page("anything", Priority::Foreground).is_err());
    }
}
