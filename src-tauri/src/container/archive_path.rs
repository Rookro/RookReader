//! Resolving and interpreting paths that point *inside* an archive.
//!
//! A folder inside a `.zip`/`.rar` is addressed by simply appending it to the archive's
//! path, e.g. `C:\books\comic.zip\ch1`. Such a path does not exist on disk, which is
//! exactly how it is told apart from a real folder that happens to be named `foo.zip`.

use std::path::{Path, PathBuf};

/// Archive extensions whose contents can be browsed as a folder tree.
///
/// PDF and EPUB are deliberately excluded: they are single documents, not folder trees.
pub const NAVIGABLE_ARCHIVE_EXTENSIONS: [&str; 4] = ["zip", "cbz", "rar", "cbr"];

/// A container path split into the archive file on disk and the folder inside it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveLocation {
    /// The archive file on disk.
    pub archive: PathBuf,
    /// The folder inside the archive, `/`-separated and without a trailing slash.
    /// Empty means the archive root.
    pub inner_dir: String,
}

/// Checks whether a path's extension names a browsable archive format.
///
/// # Arguments
///
/// * `path` - The path to inspect.
///
/// # Returns
///
/// `true` when the extension is one of [`NAVIGABLE_ARCHIVE_EXTENSIONS`] (case-insensitive).
pub fn is_navigable_archive(path: &Path) -> bool {
    path.extension()
        .map(|ext| {
            let ext = ext.to_string_lossy().to_lowercase();
            NAVIGABLE_ARCHIVE_EXTENSIONS.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

/// Resolves a path that points inside an archive.
///
/// A path that exists on disk is never an archive-inner path, so a real folder named
/// `foo.zip` keeps being read as a folder. Otherwise the ancestors are walked outwards
/// until an existing browsable archive file is found; everything below it becomes
/// [`ArchiveLocation::inner_dir`].
///
/// # Arguments
///
/// * `path` - The container path to resolve.
///
/// # Returns
///
/// The archive and the folder inside it, or `None` when `path` is a real filesystem
/// path or has no archive ancestor.
pub fn resolve(path: &str) -> Option<ArchiveLocation> {
    let path = Path::new(path);
    if path.exists() {
        return None;
    }

    let mut segments: Vec<String> = Vec::new();
    let mut current = path;
    while let (Some(name), Some(parent)) = (current.file_name(), current.parent()) {
        segments.push(name.to_string_lossy().into_owned());
        if parent.is_file() && is_navigable_archive(parent) {
            segments.reverse();
            return Some(ArchiveLocation {
                archive: parent.to_path_buf(),
                inner_dir: segments.join("/"),
            });
        }
        current = parent;
    }

    None
}

/// Normalizes a raw archive entry name to `/`-separated form.
///
/// ZIP mandates `/`, but archivers on Windows do write `\`, and both formats allow a
/// leading `./`. Everything downstream assumes the normalized form.
///
/// # Arguments
///
/// * `name` - The decoded entry name straight from the archive.
///
/// # Returns
///
/// The normalized name.
pub fn normalize_entry(name: &str) -> String {
    name.replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

/// Checks whether an entry belongs to archiver metadata that must never be shown.
///
/// macOS archivers add a `__MACOSX` tree of resource forks whose members end in image
/// extensions; listing it would show a junk folder next to the real chapters.
///
/// # Arguments
///
/// * `normalized` - A name already passed through [`normalize_entry`].
///
/// # Returns
///
/// `true` when the entry must be skipped.
pub fn is_ignored_entry(normalized: &str) -> bool {
    normalized.split('/').any(|segment| segment == "__MACOSX")
}

/// Returns the entry's file name when it sits *directly* inside `inner_dir`.
///
/// # Arguments
///
/// * `normalized` - A name already passed through [`normalize_entry`].
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// The leaf file name, or `None` when the entry lies elsewhere or deeper.
pub fn leaf_in<'a>(normalized: &'a str, inner_dir: &str) -> Option<&'a str> {
    let rest = strip_dir_prefix(normalized, inner_dir)?;
    (!rest.is_empty() && !rest.contains('/')).then_some(rest)
}

/// Returns the name of the sub-folder of `inner_dir` that contains this entry.
///
/// # Arguments
///
/// * `normalized` - A name already passed through [`normalize_entry`].
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// The immediate child folder name, or `None` when the entry is not below `inner_dir`
/// or sits directly in it.
pub fn child_dir_in<'a>(normalized: &'a str, inner_dir: &str) -> Option<&'a str> {
    let rest = strip_dir_prefix(normalized, inner_dir)?;
    rest.split_once('/')
        .map(|(head, _)| head)
        .filter(|head| !head.is_empty())
}

/// Appends a child folder name to an inner directory path.
///
/// # Arguments
///
/// * `inner_dir` - The parent folder inside the archive; empty means the archive root.
/// * `child` - The child folder name.
///
/// # Returns
///
/// The joined `/`-separated inner path.
pub fn join_inner(inner_dir: &str, child: &str) -> String {
    if inner_dir.is_empty() {
        child.to_string()
    } else {
        format!("{inner_dir}/{child}")
    }
}

/// Strips `inner_dir` (and its separator) off the front of a normalized entry name.
fn strip_dir_prefix<'a>(normalized: &'a str, inner_dir: &str) -> Option<&'a str> {
    if inner_dir.is_empty() {
        return Some(normalized);
    }
    normalized
        .strip_prefix(inner_dir)
        .and_then(|rest| rest.strip_prefix('/'))
}

#[cfg(test)]
mod tests {
    use rstest::*;
    use tempfile::tempdir;

    use super::*;

    #[rstest]
    #[case("comic.zip", true)]
    #[case("comic.ZIP", true)]
    #[case("comic.cbz", true)]
    #[case("comic.rar", true)]
    #[case("comic.CBR", true)]
    #[case("book.pdf", false)]
    #[case("book.epub", false)]
    #[case("folder", false)]
    fn is_navigable_archive_matches_browsable_formats(#[case] name: &str, #[case] expected: bool) {
        assert_eq!(expected, is_navigable_archive(Path::new(name)));
    }

    #[test]
    fn resolve_splits_a_path_pointing_inside_an_archive() {
        let dir = tempdir().expect("tempdir");
        let archive = dir.path().join("comic.zip");
        std::fs::write(&archive, b"not a real zip").expect("write archive");

        let inner = archive.join("ch1").join("part2");
        let resolved = resolve(inner.to_string_lossy().as_ref()).expect("resolves");

        assert_eq!(archive, resolved.archive);
        assert_eq!("ch1/part2", resolved.inner_dir);
    }

    #[test]
    fn resolve_ignores_a_real_folder_named_like_an_archive() {
        // A folder literally called `comic.zip` must keep being read as a folder.
        let dir = tempdir().expect("tempdir");
        let folder = dir.path().join("comic.zip");
        std::fs::create_dir(&folder).expect("create dir");
        let child = folder.join("ch1");
        std::fs::create_dir(&child).expect("create child");

        assert_eq!(None, resolve(folder.to_string_lossy().as_ref()));
        assert_eq!(None, resolve(child.to_string_lossy().as_ref()));
    }

    #[test]
    fn resolve_returns_none_for_a_plain_missing_path() {
        let dir = tempdir().expect("tempdir");
        let missing = dir.path().join("nope").join("gone");
        assert_eq!(None, resolve(missing.to_string_lossy().as_ref()));
    }

    #[rstest]
    #[case("ch1\\001.jpg", "ch1/001.jpg")]
    #[case("./ch1/001.jpg", "ch1/001.jpg")]
    #[case("ch1/001.jpg", "ch1/001.jpg")]
    fn normalize_entry_produces_slash_separated_names(#[case] raw: &str, #[case] expected: &str) {
        assert_eq!(expected, normalize_entry(raw));
    }

    #[rstest]
    #[case("__MACOSX/ch1/._001.jpg", true)]
    #[case("ch1/__MACOSX/._001.jpg", true)]
    #[case("ch1/001.jpg", false)]
    fn is_ignored_entry_skips_macos_metadata(#[case] name: &str, #[case] expected: bool) {
        assert_eq!(expected, is_ignored_entry(name));
    }

    #[rstest]
    #[case("001.jpg", "", Some("001.jpg"))]
    #[case("ch1/001.jpg", "", None)]
    #[case("ch1/001.jpg", "ch1", Some("001.jpg"))]
    #[case("ch1/part2/001.jpg", "ch1", None)]
    #[case("ch1/part2/001.jpg", "ch1/part2", Some("001.jpg"))]
    #[case("ch10/001.jpg", "ch1", None)]
    fn leaf_in_matches_only_direct_children(
        #[case] entry: &str,
        #[case] inner_dir: &str,
        #[case] expected: Option<&str>,
    ) {
        assert_eq!(expected, leaf_in(entry, inner_dir));
    }

    #[rstest]
    #[case("ch1/001.jpg", "", Some("ch1"))]
    #[case("001.jpg", "", None)]
    #[case("ch1/part2/001.jpg", "ch1", Some("part2"))]
    #[case("ch1/001.jpg", "ch1", None)]
    #[case("ch10/001.jpg", "ch1", None)]
    fn child_dir_in_reports_the_immediate_sub_folder(
        #[case] entry: &str,
        #[case] inner_dir: &str,
        #[case] expected: Option<&str>,
    ) {
        assert_eq!(expected, child_dir_in(entry, inner_dir));
    }

    #[rstest]
    #[case("", "ch1", "ch1")]
    #[case("ch1", "part2", "ch1/part2")]
    fn join_inner_builds_slash_separated_paths(
        #[case] inner_dir: &str,
        #[case] child: &str,
        #[case] expected: &str,
    ) {
        assert_eq!(expected, join_inner(inner_dir, child));
    }
}
