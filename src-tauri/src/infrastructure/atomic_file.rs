//! Writing a file so that a reader never sees it half-written.

use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

/// Makes each staging file name unique to its write, so two writers of the same target
/// never rename the same temporary file.
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

fn staging_path(target: &Path) -> PathBuf {
    let n = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let name = target
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    target.with_file_name(format!("{name}.tmp.{}.{n}", std::process::id()))
}

/// Writes `bytes` to `target` through a temporary file next to it, then renames it over.
///
/// A crash mid-write leaves the target untouched, and two concurrent writers of the same
/// target each rename their own file, so the last rename wins whole.
///
/// # Arguments
///
/// * `target` - The file to write.
/// * `bytes` - Its full new contents.
///
/// # Errors
///
/// Returns the I/O error of the write or the rename; a failed rename removes the
/// temporary file first.
pub fn write_atomically(target: &Path, bytes: &[u8]) -> io::Result<()> {
    let tmp = staging_path(target);
    fs::write(&tmp, bytes)?;
    if let Err(e) = fs::rename(&tmp, target) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_the_full_contents_and_leaves_no_staging_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("out.bin");
        write_atomically(&target, b"hello").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"hello");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn two_writes_of_one_target_use_different_staging_names() {
        let target = Path::new("/x/settings.json");
        let a = staging_path(target);
        let b = staging_path(target);
        assert_ne!(a, b);
        assert_eq!(a.parent(), target.parent());
        assert_eq!(b.parent(), target.parent());
    }

    #[test]
    fn a_failed_rename_removes_the_staging_file() {
        let dir = tempfile::tempdir().unwrap();
        // Renaming a file over a non-empty directory fails on every platform.
        let target = dir.path().join("dir");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("child"), b"").unwrap();
        assert!(write_atomically(&target, b"x").is_err());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
