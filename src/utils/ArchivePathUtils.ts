/**
 * Archive extensions whose contents the File Navigator can browse as folders.
 *
 * Mirrors `NAVIGABLE_ARCHIVE_EXTENSIONS` in `src-tauri/src/container/archive_path.rs`.
 * PDF and EPUB are single documents and are deliberately excluded.
 */
const NAVIGABLE_ARCHIVE_EXTENSIONS = ["zip", "cbz", "rar", "cbr"];

/**
 * Determines whether an entry name is an archive that can be browsed as folders.
 *
 * @param name - The file name to test.
 * @returns True when the name ends with a browsable archive extension.
 */
export const isNavigableArchiveName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return NAVIGABLE_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
};

/**
 * Determines whether a path points *inside* an archive rather than at a real filesystem
 * location. The archive file itself does not count as "inside".
 *
 * @param path - The absolute path to test.
 * @returns True when some ancestor segment is a browsable archive.
 */
export const isInsideArchive = (path: string): boolean =>
  path
    .split(/[\\/]/)
    .slice(0, -1)
    .some((segment) => isNavigableArchiveName(segment));
