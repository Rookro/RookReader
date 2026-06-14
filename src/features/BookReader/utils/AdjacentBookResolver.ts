import { basename, dirname, join } from "@tauri-apps/api/path";
import {
  getAllBooksWithState,
  getBooksWithStateByBookshelfId,
  getBooksWithStateBySeriesId,
} from "../../../bindings/BookCommands";
import { getEntriesInDir } from "../../../bindings/DirectoryCommands";
import type { BookWithState } from "../../../domain/book/schema";
import type { SortOrder } from "../../../types/AppSettings";
import { convertEntriesInDir } from "../../../utils/DirEntryUtils";
import { sortBy as sortBooks, sortBySeriesOrder } from "../../Bookshelf/utils/BookshelfUtils";
import type { OpenOrigin } from "../types/OpenOrigin";
import { sortBy as sortDirEntries } from "./FileNavigatorUtils";

/** Navigation direction relative to the current book. */
export type Direction = "next" | "previous";

/** A resolved adjacent book to open. */
export interface AdjacentBook {
  /** Absolute file path of the book to open. */
  filePath: string;
  /** Human-readable title used for toast feedback. */
  displayName: string;
}

/**
 * Returns the element adjacent to `currentIdx` in the given direction, or null when
 * `currentIdx` is not found or the adjacent index is out of bounds.
 */
const pickAdjacent = <T>(sorted: T[], currentIdx: number, dir: Direction): T | null => {
  if (currentIdx === -1) {
    return null;
  }
  const target = dir === "next" ? sorted[currentIdx + 1] : sorted[currentIdx - 1];
  return target ?? null;
};

/**
 * Resolves the adjacent book within the current book's series, ordered by series_order.
 * Series order is authoritative: at a series boundary this returns null.
 */
const adjacentInSeries = async (
  book: BookWithState,
  dir: Direction,
): Promise<AdjacentBook | null> => {
  if (book.series_id == null) {
    return null;
  }
  const books = [...(await getBooksWithStateBySeriesId(book.series_id))].sort(sortBySeriesOrder);
  const idx = books.findIndex((b) => b.id === book.id);
  const target = pickAdjacent(books, idx, dir);
  return target ? { filePath: target.file_path, displayName: target.display_name } : null;
};

/**
 * Resolves the adjacent book within the bookshelf the current book was opened from,
 * using the active bookshelf sort order.
 */
const adjacentInBookshelf = async (
  origin: Extract<OpenOrigin, { kind: "bookshelf" }>,
  currentPath: string,
  dir: Direction,
): Promise<AdjacentBook | null> => {
  const books =
    origin.bookshelfId === null
      ? await getAllBooksWithState()
      : await getBooksWithStateByBookshelfId(origin.bookshelfId);
  const sorted = [...books].sort((a, b) => sortBooks(a, b, origin.sortOrder));
  const idx = sorted.findIndex((b) => b.file_path === currentPath);
  const target = pickAdjacent(sorted, idx, dir);
  return target ? { filePath: target.file_path, displayName: target.display_name } : null;
};

/**
 * Resolves the adjacent entry in the same directory as the current book, ordered to
 * match what the user sees in the File Navigator (its active sort order). Both files
 * and directories are valid candidates, since a directory can itself be a book
 * (DirectoryContainer). The backend already filters listed files to supported formats.
 */
const adjacentInDirectory = async (
  currentPath: string,
  dir: Direction,
  sortOrder: SortOrder,
): Promise<AdjacentBook | null> => {
  const dirPath = await dirname(currentPath);
  const entries = convertEntriesInDir(await getEntriesInDir(dirPath)).sort((a, b) =>
    sortDirEntries(a, b, sortOrder),
  );
  const currentName = await basename(currentPath);
  const idx = entries.findIndex((entry) => entry.name === currentName);
  const target = pickAdjacent(entries, idx, dir);
  if (!target) {
    return null;
  }
  return { filePath: await join(dirPath, target.name), displayName: target.name };
};

/**
 * Resolves the next/previous book to open for the current book, applying a path-aware
 * priority:
 *
 * - Bookshelf origin: series order when the book belongs to a series (authoritative),
 *   otherwise the active bookshelf sort order.
 * - Any other origin (File Navigator / History / Drag&Drop / Startup): the same
 *   directory order. Series metadata is intentionally ignored here, because opening a
 *   book from the file system should follow the directory, not the series.
 *
 * @param book - The currently opened book (with its series metadata), or null.
 * @param currentPath - The absolute path of the currently opened book.
 * @param origin - Where the current book was launched from.
 * @param dir - The navigation direction.
 * @param fileNavigatorSortOrder - The File Navigator's active sort order, used for the
 *   same-directory resolution so it matches what the user sees.
 * @returns The adjacent book to open, or null when none is found.
 */
export const resolveAdjacentBook = async (
  book: BookWithState | null,
  currentPath: string,
  origin: OpenOrigin | null,
  dir: Direction,
  fileNavigatorSortOrder: SortOrder,
): Promise<AdjacentBook | null> => {
  if (!currentPath) {
    return null;
  }

  // Series is prioritized only when the book was opened from the Bookshelf.
  if (origin?.kind === "bookshelf") {
    if (book?.series_id != null) {
      return adjacentInSeries(book, dir);
    }
    return adjacentInBookshelf(origin, currentPath, dir);
  }

  // File Navigator / History / Drag&Drop / Startup -> same directory order.
  return adjacentInDirectory(currentPath, dir, fileNavigatorSortOrder);
};
