import { useMemo } from "react";
import type { BookWithState } from "../../../domain/book/schema";
import type { GridItem } from "../components/BookGridCell";

/**
 * Locates the book currently being read within the grid.
 *
 * @param readingBook - The book that is currently open, or null if none.
 * @param items - The grid items currently displayed in the bookshelf.
 * @returns The index of the reading book in `items`, or -1 when there is none or it is not shown.
 */
export function useReadingBookIndex(readingBook: BookWithState | null, items: GridItem[]): number {
  return useMemo(
    () =>
      readingBook
        ? items.findIndex((item) => item.type === "book" && item.data.id === readingBook.id)
        : -1,
    [readingBook, items],
  );
}
