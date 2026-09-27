import { debug, error } from "@tauri-apps/plugin-log";
import { useEffect, useRef } from "react";
import type { GridImperativeAPI } from "react-window";
import type { BookWithState } from "../../../domain/book/schema";
import type { GridItem } from "../utils/BookshelfUtils";

/** Options for {@link useScrollToReadingBook}. */
export interface ScrollToReadingBookOptions {
  /** The virtualized grid to scroll, once it has mounted. */
  grid: GridImperativeAPI | null;
  /** The grid items in display order. */
  items: GridItem[];
  /** The book currently open in the reader, or null if none. */
  readingBook: BookWithState | null;
  /** The index of `readingBook` in `items`, or -1 when it is not shown. */
  readingBookIndex: number;
  /** The number of columns in the grid. */
  columnCount: number;
  /** The measured width available to the grid; 0 until the container is measured. */
  gridWidth: number;
  /** The view currently on screen. */
  activeView: "reader" | "bookshelf";
}

/**
 * Scrolls the grid to the book being read, once per visit to the bookshelf.
 *
 * The scroll latches after it has happened so that later refetches do not yank the
 * grid back while the user is browsing; leaving the bookshelf re-arms it.
 *
 * @param options - The grid, its items, the reading book and the layout it depends on.
 */
export function useScrollToReadingBook({
  grid,
  items,
  readingBook,
  readingBookIndex,
  columnCount,
  gridWidth,
  activeView,
}: ScrollToReadingBookOptions): void {
  const hasAutoScrolledRef = useRef(false);

  // Reset auto-scroll flag when leaving the bookshelf view
  useEffect(() => {
    if (activeView !== "bookshelf") {
      hasAutoScrolledRef.current = false;
    }
  }, [activeView]);

  // Scroll to make the selected item visible
  useEffect(() => {
    if (items.length === 0 || !grid || activeView !== "bookshelf" || hasAutoScrolledRef.current) {
      return;
    }

    // Wait until the container has been measured so columnCount is accurate.
    // Scrolling with the fallback columnCount=1 would target the wrong row and
    // then latch, preventing a correct re-scroll. The effect re-runs when
    // columnCount changes (its dependency), so this resumes once width arrives.
    if (gridWidth <= 0) {
      return;
    }

    // Use setTimeout to push the scroll command to the end of the event loop.
    // This ensures that the virtualized list (react-window) has finished
    // rendering and measuring item positions before attempting to scroll.
    const timerId = setTimeout(() => {
      try {
        if (readingBookIndex === -1) {
          // Conclude the session only when there is genuinely no reading book. If a
          // reading book exists but its index has not resolved yet (books still
          // loading), leave the latch off so a later run can scroll once it's known.
          if (!readingBook) {
            hasAutoScrolledRef.current = true;
          }
        } else {
          debug(`Scrolling to cell ${readingBookIndex}.`);
          grid.scrollToCell({
            behavior: "instant",
            columnAlign: "smart",
            rowAlign: "smart",
            columnIndex: readingBookIndex % columnCount,
            rowIndex: Math.floor(readingBookIndex / columnCount),
          });
          hasAutoScrolledRef.current = true;
        }
      } catch (e) {
        error(`Failed to scroll to cell ${readingBookIndex}: ${e}`);
      }
    }, 20);

    return () => {
      clearTimeout(timerId);
    };
  }, [readingBookIndex, readingBook, items, grid, columnCount, activeView, gridWidth]);
}
