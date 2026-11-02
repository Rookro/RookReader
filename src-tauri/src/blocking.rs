//! Runs blocking work off the async runtime.

use crate::error::{Error, Result};

/// Runs `work` on a blocking thread and returns what it returns.
///
/// # Arguments
///
/// * `work` - The blocking work. Its own error is converted into an [`Error`].
///
/// # Returns
///
/// The value `work` returned.
///
/// # Errors
///
/// Returns `work`'s own error, converted, or [`Error::Other`] when the thread could not
/// finish it (for example, `work` panicked).
pub(crate) async fn run_blocking<T, E, F>(work: F) -> Result<T>
where
    F: FnOnce() -> std::result::Result<T, E> + Send + 'static,
    T: Send + 'static,
    E: Into<Error> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| Error::Other(format!("Spawn blocking failed: {e}")))?
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn returns_what_the_work_returns() {
        assert_eq!(run_blocking(|| Ok::<_, Error>(7)).await.unwrap(), 7);
    }

    #[tokio::test]
    async fn converts_the_work_s_own_error() {
        let result = run_blocking(|| std::fs::read("definitely/not/here")).await;
        assert!(matches!(result, Err(Error::PathNotFound(_))));
    }

    #[tokio::test]
    async fn reports_work_that_could_not_finish() {
        let result = run_blocking(|| -> Result<()> { panic!("boom") }).await;
        let Err(Error::Other(message)) = result else {
            panic!("expected Error::Other");
        };
        assert!(message.starts_with("Spawn blocking failed: "));
    }
}
