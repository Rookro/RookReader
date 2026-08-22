//! Reading the folder structure inside an archive.
//!
//! Both answers this module gives are derived from the archive's *image* entries, so a
//! folder holding nothing readable — `__MACOSX`, a metadata-only folder — is invisible
//! everywhere: it is never listed, and never descended into.

use std::{collections::BTreeSet, fs::File, path::Path};

use crate::{
    container::{archive_path, zip_container::decode_entry_name},
    error::{Error, Result},
    image::types::Image,
};

/// How many levels [`resolve_content_dir`] will descend before giving up.
///
/// A bound rather than a limit anyone should hit: it exists so a malformed listing can
/// never spin.
const MAX_DESCEND_DEPTH: usize = 32;

/// Lists the sub-folders that sit directly inside `inner_dir` of `archive`.
///
/// Files are never listed: only a folder inside an archive can be opened as a book.
///
/// # Arguments
///
/// * `archive` - The archive file on disk.
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// The naturally-sorted child folder names.
///
/// # Errors
///
/// Returns an `Err` if the archive is not a browsable format or cannot be read.
pub fn list_child_dirs(archive: &Path, inner_dir: &str) -> Result<Vec<String>> {
    Ok(child_dirs(&read_image_entry_names(archive)?, inner_dir))
}

/// Finds the folder that actually holds the pages, starting at `inner_dir`.
///
/// While the current level holds no images and has exactly one sub-folder, that
/// sub-folder is entered. This makes the common `comic.zip` → `Comic/` → `*.jpg` layout
/// — and deeper single-folder chains — open in one click. The walk stops as soon as a
/// level holds images, or has zero or several sub-folders.
///
/// # Arguments
///
/// * `archive` - The archive file on disk.
/// * `inner_dir` - The folder to start from; empty means the archive root.
///
/// # Returns
///
/// The `/`-separated inner path to open, which is `inner_dir` itself when nothing is
/// gained by descending.
///
/// # Errors
///
/// Returns an `Err` if the archive is not a browsable format or cannot be read.
pub fn resolve_content_dir(archive: &Path, inner_dir: &str) -> Result<String> {
    Ok(descend_to_content(
        &read_image_entry_names(archive)?,
        inner_dir,
    ))
}

/// Walks down single-sub-folder chains until a level with images is reached.
///
/// Split out from [`resolve_content_dir`] so the rule is testable without an archive.
fn descend_to_content(names: &[String], inner_dir: &str) -> String {
    let mut current = inner_dir.to_string();

    for _ in 0..MAX_DESCEND_DEPTH {
        let has_pages = names
            .iter()
            .any(|name| archive_path::leaf_in(name, &current).is_some());
        if has_pages {
            break;
        }

        let children = child_dirs(names, &current);
        let [only_child] = children.as_slice() else {
            break;
        };
        current = archive_path::join_inner(&current, only_child);
    }

    current
}

/// Collects the immediate sub-folders of `inner_dir`, naturally sorted.
fn child_dirs(names: &[String], inner_dir: &str) -> Vec<String> {
    let dirs: BTreeSet<&str> = names
        .iter()
        .filter_map(|name| archive_path::child_dir_in(name, inner_dir))
        .collect();

    let mut dirs: Vec<String> = dirs.into_iter().map(str::to_string).collect();
    dirs.sort_by(|a, b| natord::compare_ignore_case(a, b));
    dirs
}

/// Reads the archive's supported-image entry names, normalized and de-noised.
fn read_image_entry_names(archive: &Path) -> Result<Vec<String>> {
    let ext = archive
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let names = match ext.as_str() {
        "zip" | "cbz" => read_zip_entry_names(archive)?,
        "rar" | "cbr" => read_rar_entry_names(archive)?,
        _ => {
            return Err(Error::UnsupportedContainer(format!(
                "Not a browsable archive: {ext}"
            )))
        }
    };

    Ok(names
        .into_iter()
        .filter(|name| !archive_path::is_ignored_entry(name) && Image::is_supported_format(name))
        .collect())
}

/// Reads the ZIP central directory, decoding names the same way `ZipContainer` does.
fn read_zip_entry_names(archive: &Path) -> Result<Vec<String>> {
    let mut zip = zip::ZipArchive::new(File::open(archive)?)?;
    let mut names = Vec::with_capacity(zip.len());
    for index in 0..zip.len() {
        let file = zip.by_index(index)?;
        names.push(archive_path::normalize_entry(&decode_entry_name(
            file.name_raw(),
        )));
    }
    Ok(names)
}

/// Reads a RAR listing without extracting anything.
fn read_rar_entry_names(archive: &Path) -> Result<Vec<String>> {
    let listing = unrar::Archive::new(archive).open_for_listing()?;
    let mut names = Vec::new();
    for entry in listing {
        let entry = entry?;
        if entry.is_file() {
            names.push(archive_path::normalize_entry(
                entry.filename.to_string_lossy().as_ref(),
            ));
        }
    }
    Ok(names)
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use rstest::*;
    use tempfile::tempdir;
    use zip::write::{FileOptions, ZipWriter};

    use super::*;

    fn create_zip(dir: &Path, names: &[&str]) -> std::path::PathBuf {
        let zip_path = dir.join("test.zip");
        let mut zip = ZipWriter::new(File::create(&zip_path).expect("create zip"));
        for name in names {
            zip.start_file(*name, FileOptions::<()>::default())
                .expect("start entry");
            zip.write_all(&[0u8]).expect("write entry");
        }
        zip.finish().expect("finish zip");
        zip_path
    }

    fn names(raw: &[&str]) -> Vec<String> {
        raw.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn lists_the_child_folders_of_the_archive_root() {
        let dir = tempdir().expect("tempdir");
        let zip = create_zip(
            dir.path(),
            &[
                "cover.png",
                "ch2/001.png",
                "ch10/001.png",
                "ch1/001.png",
                "ch1/deeper/002.png",
            ],
        );

        // Naturally sorted, one row per direct child, no files.
        assert_eq!(
            vec!["ch1".to_string(), "ch2".to_string(), "ch10".to_string()],
            list_child_dirs(&zip, "").expect("lists")
        );
    }

    #[test]
    fn lists_the_child_folders_of_a_nested_folder() {
        let dir = tempdir().expect("tempdir");
        let zip = create_zip(dir.path(), &["ch1/001.png", "ch1/deeper/002.png"]);

        assert_eq!(
            vec!["deeper".to_string()],
            list_child_dirs(&zip, "ch1").expect("lists")
        );
        assert!(list_child_dirs(&zip, "ch1/deeper")
            .expect("lists")
            .is_empty());
    }

    #[test]
    fn hides_folders_with_nothing_readable_beneath_them() {
        let dir = tempdir().expect("tempdir");
        let zip = create_zip(
            dir.path(),
            &["ch1/001.png", "__MACOSX/ch1/._001.png", "notes/readme.txt"],
        );

        assert_eq!(
            vec!["ch1".to_string()],
            list_child_dirs(&zip, "").expect("lists")
        );
    }

    #[test]
    fn rejects_a_format_that_cannot_be_browsed() {
        let dir = tempdir().expect("tempdir");
        let pdf = dir.path().join("book.pdf");
        std::fs::write(&pdf, b"not a real pdf").expect("write pdf");

        let Err(err) = list_child_dirs(&pdf, "") else {
            panic!("expected an unsupported-container error");
        };
        assert!(err.to_string().contains("Not a browsable archive"));
    }

    #[rstest]
    // A single wrapper folder is entered.
    #[case(&["Comic/001.png", "Comic/002.png"], "", "Comic")]
    // ...however deep the chain of single folders goes.
    #[case(&["Comic/path/deep/001.png"], "", "Comic/path/deep")]
    // Stops at the first level that holds pages, even if it also has sub-folders.
    #[case(&["Comic/001.png", "Comic/extra/002.png"], "", "Comic")]
    // Several sub-folders: there is nothing to pick, so the level is kept.
    #[case(&["ch1/001.png", "ch2/001.png"], "", "")]
    // Images at the root already: never descend.
    #[case(&["cover.png", "ch1/001.png"], "", "")]
    // Descending also applies below the root.
    #[case(&["ch1/only/001.png"], "ch1", "ch1/only")]
    // Nothing readable at all: the level is kept, and the caller rejects it as empty.
    #[case(&[], "", "")]
    fn descend_to_content_follows_single_folder_chains(
        #[case] entries: &[&str],
        #[case] inner_dir: &str,
        #[case] expected: &str,
    ) {
        assert_eq!(expected, descend_to_content(&names(entries), inner_dir));
    }

    #[test]
    fn resolve_content_dir_reads_the_chain_from_a_real_archive() {
        let dir = tempdir().expect("tempdir");
        let zip = create_zip(dir.path(), &["Comic/path/deep/001.png"]);

        assert_eq!(
            "Comic/path/deep",
            resolve_content_dir(&zip, "").expect("resolves")
        );
    }
}
