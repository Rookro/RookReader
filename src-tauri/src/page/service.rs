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

use crate::{
    container::traits::{Container, PageReader},
    error::{Error, Result},
    image::types::{Image, ImageDimensions},
    page::{
        cache::{Cache, CacheKey},
        pipeline::Pipeline,
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
    in_flight: HashMap<String, Vec<mpsc::Sender<Result<Arc<Image>>>>>,
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
                closed: false,
            }),
            wake: Condvar::new(),
            cache: RwLock::new(cache),
            pipeline,
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
        let span = Span::start();
        if let Some(image) = self.shared.cached(entry) {
            perf!(
                span,
                "page",
                "entry={entry} prio={priority:?} source=cache queued=0"
            );
            return Ok(image);
        }

        let index = self.index_of(entry)?;
        let (tx, rx) = mpsc::channel();
        // What the wait is spent on, which is what makes the duration readable: a page
        // already being read is joined rather than read again.
        let (source, queued) = {
            let mut queue = self.shared.lock();
            if queue.closed {
                return Err(closed());
            }
            let queued = queue.jobs.len() + queue.preload.len();
            match queue.in_flight.entry(entry.to_string()) {
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
                        reply: Reply::Page(tx),
                    });
                    ("read", queued)
                }
            }
        };
        self.shared.wake.notify_one();

        let page = rx.recv().map_err(|_| closed())?;
        perf!(
            span,
            "page",
            "entry={entry} prio={priority:?} source={source} queued={queued}"
        );
        page
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
        let span = Span::start();
        if self.shared.cached(entry).is_some() {
            perf!(span, "preview", "entry={entry} source=cached-page");
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

        let preview = rx.recv().map_err(|_| closed())?;
        let source = match &preview {
            Ok(Some(_)) => "render",
            // Every format but PDF: a preview costs the page's own read and decode, so
            // there is nothing cheaper to make.
            Ok(None) => "unsupported",
            Err(_) => "failed",
        };
        perf!(span, "preview", "entry={entry} source={source}");
        preview
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
    /// the one they are in. A job a worker has already picked up still finishes. This
    /// replaces the old generation counter; book switches are cancelled by
    /// [`PageService::close`].
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
        let end = (center + buffer + 1).min(entries.len());
        let first_ahead = center.saturating_add(caller_pages).min(entries.len());
        let ahead = first_ahead..end.max(first_ahead);
        let behind = start..center.min(entries.len());

        let span = Span::start();
        let (ahead_len, behind_len) = (ahead.len(), behind.len());
        let mut cached = 0usize;

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
                if self.shared.cached(entry).is_some() {
                    cached += 1;
                    continue;
                }
                queue.preload.push(Job {
                    priority,
                    order: (index, 1),
                    entry: entry.clone(),
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
    /// The entry still owed an answer, taken once one has been given.
    entry: Option<String>,
}

impl Delivery<'_> {
    /// Records that the waiters have been answered.
    fn done(&mut self) {
        self.entry = None;
    }
}

impl Drop for Delivery<'_> {
    fn drop(&mut self) {
        let Some(entry) = self.entry.take() else {
            return;
        };
        // Dropping the senders is what wakes a blocked `recv`; there is no result to
        // send, because whatever was going to produce one is gone.
        self.shared.lock().in_flight.remove(&entry);
    }
}

/// One reader thread's whole life.
fn worker(shared: Arc<Shared>, container: Arc<dyn Container>) {
    let _life = WorkerLife(&shared);
    let mut reader: Option<Box<dyn PageReader>> = None;

    loop {
        let Some(job) = next_job(&shared) else { return };
        let _slot = PreloadSlot(job.priority.is_preload().then_some(&*shared));
        // Armed for the length of this job: whatever ends it — a delivery, an early
        // return, an unwind out of the decoder — the callers attached to this entry are
        // let go rather than left waiting on a read that is no longer running.
        let mut delivery = Delivery {
            shared: &shared,
            entry: job.reads_the_page().then(|| job.entry.clone()),
        };

        // Another worker may have cached this page between the enqueue and this pop.
        // Answer from the cache rather than skipping the job: skipping would drop
        // `job.reply` with it, and a caller blocked in `page()` would see a closed
        // channel — a spurious failure on what is in fact a cache hit.
        if job.reads_the_page() {
            if let Some(image) = shared.cached(&job.entry) {
                deliver_page(&shared, &job, Ok(image));
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
                    let message = e.to_string();
                    deliver_error(&shared, &job, &message);
                    delivery.done();
                    // The handle will not appear on a retry, so leave rather than fail
                    // every remaining job one at a time. Whatever is still queued is
                    // failed by `worker_left` once the last reader has gone.
                    log::error!("Failed to open a page reader: {message}");
                    return;
                }
            }
        }
        let Some(reader) = reader.as_mut() else {
            return;
        };

        run(&shared, reader.as_mut(), job);
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

            if take_preload || !queue.jobs.is_empty() {
                let heap = if take_preload {
                    &mut queue.preload
                } else {
                    &mut queue.jobs
                };
                let job = heap.pop().expect("a job was just peeked");
                if job.reads_the_page() {
                    match queue.in_flight.entry(job.entry.clone()) {
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
fn run(shared: &Shared, reader: &mut dyn PageReader, job: Job) {
    match &job.reply {
        Reply::Dimensions(index, tx) => {
            let _ = tx.send((*index, reader.page_dimensions(&job.entry)));
        }
        Reply::Preview(tx) => {
            let preview = reader.read_preview(&job.entry).and_then(|bytes| {
                bytes
                    .map(|bytes| shared.pipeline.preview(bytes))
                    .transpose()
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

    /// How many jobs are waiting, and which entries are being read right now.
    ///
    /// The tests below are in this module, so they can wait on the scheduler's own state
    /// instead of sleeping long enough to usually be right.
    fn queued(service: &PageService) -> usize {
        let queue = service.shared.lock();
        queue.jobs.len() + queue.preload.len()
    }

    fn reading(service: &PageService, entry: &str) -> bool {
        service.shared.lock().in_flight.contains_key(entry)
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
            thread::spawn(move || service.page(&wanted, Priority::Foreground))
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
                Ok(page_bytes())
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
            mini_moka::sync::Cache::new(1000),
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
                let page = service.page(&wanted, Priority::Foreground);
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

        // A solid RAR, an EPUB, a PDF: reserving a worker here would reserve the only one.
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
                mini_moka::sync::Cache::new(1000),
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
                    let page = service.page(&name, Priority::Foreground);
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
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            mini_moka::sync::Cache::new(1000),
            2,
        ));

        assert!(
            service.page(&doomed, Priority::Foreground).is_err(),
            "the caller whose worker died must be told"
        );

        // The entry must no longer be marked as being read: a second request has to queue
        // a job of its own rather than attach to a read nobody is performing.
        let served = Arc::new(AtomicUsize::new(0));
        let again = {
            let (service, served, doomed) = (service.clone(), served.clone(), doomed.clone());
            thread::spawn(move || {
                let page = service.page(&doomed, Priority::Foreground);
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
        assert!(service.page(&names[0], Priority::Foreground).is_err());
        assert!(service.dimensions().is_err());
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
            0,
        );

        service.request_preload_around(0, 3, 0).unwrap();
        // The worker is now parked inside the first window's first page.
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
                Ok(page_bytes())
            });
            Ok(Box::new(reader) as Box<dyn PageReader>)
        });

        let service = Arc::new(PageService::new(
            "book".to_string(),
            Arc::new(container),
            pipeline(),
            mini_moka::sync::Cache::new(1000),
            0,
        ));

        let wanted = names[0].clone();
        let first = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page(&wanted, Priority::Foreground))
        };
        // Only once the page is genuinely being read does the second caller have anything
        // to join; before that it would simply queue a job of its own.
        eventually("the first read to start", || reading(&service, &wanted));

        let second = {
            let service = service.clone();
            let wanted = wanted.clone();
            thread::spawn(move || service.page(&wanted, Priority::Foreground))
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
        eventually("both workers to park", || {
            parked.load(Ordering::SeqCst) == 2
        });

        let callers: Vec<_> = (0..2)
            .map(|_| {
                let service = service.clone();
                let wanted = names[2].clone();
                thread::spawn(move || service.page(&wanted, Priority::Foreground))
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
            mini_moka::sync::Cache::new(1000),
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
        let measured = service(container).dimensions().unwrap();
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

        let measured = service(recording_container(names.clone(), 1, log))
            .dimensions()
            .unwrap();
        assert_eq!(measured.len(), 40);

        // Forty pages, one line. A record per page would cost more in log I/O than the
        // scan costs in work, and would bury every other record in the file.
        let lines = recording.lines("scan");
        assert_eq!(lines.len(), 1, "{lines:?}");
        assert!(lines[0].contains(" pages=40 failed=0 ms="), "{}", lines[0]);
    }

    #[test]
    fn a_page_record_says_which_of_the_three_it_was() {
        let recording = crate::perf::capture::record();
        let names = entries(2);
        let log = Arc::new(Mutex::new(Vec::new()));
        let service = service(recording_container(names.clone(), 1, log));

        service.page(&names[0], Priority::Foreground).unwrap();
        service.page(&names[0], Priority::Foreground).unwrap();

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
            mini_moka::sync::Cache::new(100),
            0,
        );

        assert_eq!(service.dimensions().unwrap(), Vec::new());
        service.request_preload_around(0, 5, 0).unwrap();
        assert!(service.page("anything", Priority::Foreground).is_err());
    }
}
