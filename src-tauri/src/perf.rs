//! Performance logging that costs nothing when nobody has asked for it.
//!
//! The log level is a reader's setting and its default is `Info`, so these records are
//! opt-in. The guarantee this module exists to keep is that at `Info` they cost not one
//! instruction more than the code would without them: no clock is read, nothing is
//! formatted, nothing is allocated.
//!
//! # Format
//!
//! One line per event, `op` first and the total `ms` last, so a whole distribution is a
//! `grep 'op=page' | awk -F' ms=' '{print $2}'` away. Every duration is milliseconds: the
//! total for an event is `ms`, a component of it is `<name>_ms`. The logger's own format
//! already carries the timestamp, level, target and source line, so a record here adds
//! only what it knows.
//!
//! ```text
//! perf op=page entry=0007.jpg prio=foreground source=read queued=3 ms=2.31
//! ```

use std::time::Instant;

/// A stopwatch that does not exist unless debug logging is on.
///
/// [`Span::start`] reads the clock only when a record could be written, and that check is
/// a relaxed load of the global max level — the first of the two `log::debug!` performs
/// before it formats anything. At the default level a span is an `Option` that is never
/// `Some`.
///
/// The level is read directly rather than through `log_enabled!`, which also asks the
/// installed logger whether it wants the record. That second question costs a virtual
/// call, answers `false` whenever no logger is installed at all, and can only ever narrow
/// the level for a target this crate does not override — while `log::debug!` asks it
/// anyway before writing. Spending it here would buy nothing and cost a test the ability
/// to observe the guarantee.
pub struct Span(Option<Instant>);

impl Span {
    /// Starts timing, if anything is listening.
    pub fn start() -> Self {
        Self((log::max_level() >= log::Level::Debug).then(Instant::now))
    }

    /// Whether anything is listening.
    ///
    /// For a field that costs something to work out — a lookup, a scan, a clone — and is
    /// wanted only by a record. A field that is already in hand needs no guard: the
    /// [`perf`](crate::perf) macro does not evaluate its arguments when the level is off.
    pub fn active(&self) -> bool {
        self.0.is_some()
    }

    /// Milliseconds since [`Span::start`], or `None` when nothing was measured.
    ///
    /// Returning `Option` rather than `0.0` is deliberate: a caller cannot accidentally
    /// log a duration that was never taken.
    pub fn ms(&self) -> Option<f64> {
        self.0.map(|at| at.elapsed().as_secs_f64() * 1000.0)
    }
}

/// Writes one `perf` record.
///
/// `$fields` is the event's own `key=value` text; `op` and the trailing `ms` are added
/// here so every record shares a shape. Expands to nothing observable when debug logging
/// is off, because `log::debug!` does not evaluate its arguments then.
///
/// ```ignore
/// perf!(span, "page", "entry={entry} prio={priority:?} source=read queued={queued}");
/// ```
#[macro_export]
macro_rules! perf {
    ($span:expr, $op:literal, $($fields:tt)*) => {
        if let Some(ms) = $span.ms() {
            log::debug!(concat!("perf op=", $op, " {} ms={:.2}"), format_args!($($fields)*), ms);
        }
    };
}

/// A logger that keeps a test's own `perf` records, so it can count them.
///
/// Installed once for the whole process — `log::set_logger` accepts one — and it keeps
/// only what was written **on the recording thread**. Raising the level raises it for
/// every test running beside this one, and theirs would otherwise land in the same
/// buffer; every record this crate writes is written on the thread that asked for the
/// work, so the thread is what tells them apart.
#[cfg(test)]
pub mod capture {
    use std::sync::{Mutex, OnceLock};
    use std::thread::ThreadId;

    /// The records written while [`record`] was held, oldest first, with their writer.
    static LINES: Mutex<Vec<(ThreadId, String)>> = Mutex::new(Vec::new());
    /// Held for the length of one test: only one may capture at a time, because the
    /// logger and the global level are the process's, not the test's.
    static CAPTURING: Mutex<()> = Mutex::new(());

    struct Logger;

    impl log::Log for Logger {
        fn enabled(&self, metadata: &log::Metadata) -> bool {
            metadata.level() <= log::Level::Debug
        }

        fn log(&self, record: &log::Record) {
            let line = record.args().to_string();
            if line.starts_with("perf ") {
                LINES
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .push((std::thread::current().id(), line));
            }
        }

        fn flush(&self) {}
    }

    /// Captures every `perf` record written while the returned guard is alive.
    pub fn record() -> Recording {
        at(log::LevelFilter::Debug)
    }

    /// Holds the level below debug, so a test can observe that nothing is measured.
    pub fn silence() -> Recording {
        at(log::LevelFilter::Info)
    }

    /// Takes the process's level — and its logger — for the length of one test.
    fn at(level: log::LevelFilter) -> Recording {
        static INSTALLED: OnceLock<()> = OnceLock::new();
        let guard = CAPTURING.lock().unwrap_or_else(|e| e.into_inner());
        INSTALLED.get_or_init(|| {
            let _ = log::set_logger(&Logger);
        });
        LINES.lock().unwrap_or_else(|e| e.into_inner()).clear();
        let restore = log::max_level();
        log::set_max_level(level);
        Recording {
            restore,
            thread: std::thread::current().id(),
            _guard: guard,
        }
    }

    /// Restores the level, and the silence, when it goes out of scope.
    pub struct Recording {
        restore: log::LevelFilter,
        thread: ThreadId,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl Recording {
        /// The records written so far whose `op` is `op`.
        pub fn lines(&self, op: &str) -> Vec<String> {
            let prefix = format!("perf op={op} ");
            LINES
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .iter()
                .filter(|(thread, line)| *thread == self.thread && line.starts_with(&prefix))
                .map(|(_, line)| line.clone())
                .collect()
        }
    }

    impl Drop for Recording {
        fn drop(&mut self) {
            log::set_max_level(self.restore);
            LINES.lock().unwrap_or_else(|e| e.into_inner()).clear();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_span_reads_no_clock_while_debug_logging_is_off() {
        let _silence = capture::silence();

        // This is the whole guarantee: at the level the app ships with, a span holds
        // nothing, so nothing was measured to put in it.
        assert!(Span::start().ms().is_none());
    }

    #[test]
    fn a_record_carries_its_op_and_its_duration() {
        let recording = capture::record();

        let span = Span::start();
        perf!(span, "page", "entry=001.jpg source=cache");

        let lines = recording.lines("page");
        assert_eq!(lines.len(), 1);
        assert!(
            lines[0].contains(" entry=001.jpg source=cache ms="),
            "unexpected record: {}",
            lines[0]
        );
    }

    #[test]
    fn a_span_measures_once_debug_logging_is_on() {
        let _recording = capture::record();

        assert!(Span::start().ms().is_some_and(|ms| ms >= 0.0));
    }
}
