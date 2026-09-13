import { useCallback, useEffect, useState } from "react";
import type { BookWithState } from "../../../domain/book/schema";
import type { GridItem } from "../utils/BookshelfUtils";

/** Options for {@link useGridKeyboardNavigation}. */
export interface GridKeyboardNavigationOptions {
  /** The grid items in display order. */
  items: GridItem[];
  /** The number of columns, which is how far ArrowUp/ArrowDown move. */
  columnCount: number;
  /** Called when Enter or Space is pressed on a focused book. */
  onBookActivate: (book: BookWithState, e: React.KeyboardEvent) => void;
  /** Called when Enter or Space is pressed on a focused series. */
  onSeriesActivate: (seriesId: number) => void;
}

/**
 * Moves a keyboard focus through the grid with the arrow, Home and End keys, and
 * activates the focused item with Enter or Space.
 *
 * @param options - The items, the column count and the activation callbacks.
 * @returns The focused index (-1 when nothing is focused) and the key handler for the grid.
 */
export function useGridKeyboardNavigation({
  items,
  columnCount,
  onBookActivate,
  onSeriesActivate,
}: GridKeyboardNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Keep the keyboard focus in range when the filtered list shrinks (e.g. typing
  // into the search box), so Enter/Space can't dereference a stale index.
  useEffect(() => {
    setFocusedIndex((prev) => (prev >= items.length ? -1 : prev));
  }, [items.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return;

      let nextIndex = focusedIndex;
      if (e.key === "ArrowRight") {
        nextIndex = focusedIndex === -1 ? 0 : Math.min(items.length - 1, focusedIndex + 1);
      } else if (e.key === "ArrowLeft") {
        nextIndex = focusedIndex === -1 ? 0 : Math.max(0, focusedIndex - 1);
      } else if (e.key === "ArrowDown") {
        nextIndex =
          focusedIndex === -1 ? 0 : Math.min(items.length - 1, focusedIndex + columnCount);
      } else if (e.key === "ArrowUp") {
        nextIndex = focusedIndex === -1 ? 0 : Math.max(0, focusedIndex - columnCount);
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = items.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        const item = items[focusedIndex];
        if (focusedIndex >= 0 && item) {
          e.preventDefault();
          if (item.type === "book") {
            onBookActivate(item.data, e);
          } else {
            onSeriesActivate(item.data.id);
          }
        }
        return;
      } else {
        return;
      }

      e.preventDefault();
      setFocusedIndex(nextIndex);
    },
    [focusedIndex, items, columnCount, onBookActivate, onSeriesActivate],
  );

  return { focusedIndex, handleKeyDown };
}
