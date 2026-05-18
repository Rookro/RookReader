import { useEffect } from "react";
import type { BookWithState } from "../../../types/DatabaseModels";
import type { GridItem } from "../components/BookGridCell";

/**
 * A custom hook that synchronizes the selection index of the book currently being read within a grid.
 *
 * This hook searches for the provided `readingBook` within the `items` array and
 * updates the selection index using the `setReadingBookIndex` callback. If no book
 * is being read, or if the book is not found in the current items, the index is set to -1.
 *
 * @param readingBook - The book object that is currently open/being read, or null if none.
 * @param items - The list of grid items (books, folders, etc.) currently displayed in the bookshelf.
 * @param setReadingBookIndex - A function to update the state with the index of the reading book.
 */
export function useReadingBookSelection(
  readingBook: BookWithState | null,
  items: GridItem[],
  setReadingBookIndex: (index: number) => void,
) {
  useEffect(() => {
    let cancelled = false;
    const initSelected = async () => {
      if (!readingBook) {
        if (!cancelled) {
          setReadingBookIndex(-1);
        }
        return;
      }

      const idx = items.findIndex(
        (item) => item.type === "book" && item.data.id === readingBook.id,
      );

      if (!cancelled) {
        setReadingBookIndex(idx);
      }
    };

    initSelected();

    return () => {
      cancelled = true;
    };
  }, [readingBook, items, setReadingBookIndex]);
}
