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
 * Names a book from its path, the way the window title shows it.
 *
 * A folder inside an archive is named from the nearest archive down (`comic.zip/Vol.1`);
 * any other book by its last path component.
 *
 * @param path - The book's path, with `/` or `\` separators.
 * @returns The book's name.
 */
export const bookTitleFromPath = (path: string): string => {
  const parts = path.split(/[/\\]/).filter((part) => part.length > 0);
  for (let i = parts.length - 2; i >= 0; i--) {
    if (isNavigableArchiveName(parts[i])) {
      return parts.slice(i).join("/");
    }
  }
  return parts.at(-1) ?? path;
};
