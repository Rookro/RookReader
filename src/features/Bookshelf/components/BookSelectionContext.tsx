import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { BookWithState } from "../../../types/DatabaseModels";

/** Context for managing book selection state */
interface BookSelectionContextType {
  /** Set of selected book IDs */
  selectedBookIds: Set<number>;
  /** Toggles the selection of a single book */
  toggleSelection: (bookId: number) => void;
  /** Sets the entire selection to a specific set of book IDs */
  setSelection: (bookIds: Set<number>) => void;
  /** Clears all selections */
  clearSelection: () => void;
  /** Handles shift-click or ctrl-click range selection */
  handleSelectionClick: (
    book: BookWithState,
    event: React.MouseEvent,
    filteredSortedBooks: BookWithState[],
    bookIdToIndexMap: Map<number, number>,
    onBookSelect?: (book: BookWithState) => void,
  ) => void;
}

export const BookSelectionContext = createContext<BookSelectionContextType | null>(null);

/** Hook to use the book selection context */
export const useBookSelection = () => {
  const context = useContext(BookSelectionContext);
  if (!context) {
    throw new Error("useBookSelection must be used within a BookSelectionProvider");
  }
  return context;
};

/** Props for the BookSelectionProvider component */
export interface BookSelectionProviderProps {
  children: React.ReactNode;
}

/** Provider component for book selection state */
export function BookSelectionProvider({ children }: BookSelectionProviderProps) {
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const lastClickedBookIdRef = useRef<number | null>(null);

  const toggleSelection = useCallback((bookId: number) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBookIds(new Set());
    lastClickedBookIdRef.current = null;
  }, []);

  const handleSelectionClick = useCallback(
    (
      book: BookWithState,
      e: React.MouseEvent,
      filteredSortedBooks: BookWithState[],
      bookIdToIndexMap: Map<number, number>,
      onBookSelect?: (book: BookWithState) => void,
    ) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        toggleSelection(book.id);
        lastClickedBookIdRef.current = book.id;
      } else if (e.shiftKey && lastClickedBookIdRef.current !== null) {
        // Range selection
        const currentIndex = bookIdToIndexMap.get(book.id);
        const lastIndex = bookIdToIndexMap.get(lastClickedBookIdRef.current);

        if (currentIndex !== undefined && lastIndex !== undefined) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);

          setSelectedBookIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const currentBook = filteredSortedBooks[i];
              if (currentBook) {
                next.add(currentBook.id);
              }
            }
            return next;
          });
        }
      } else {
        let shouldOpen = false;
        setSelectedBookIds((prev) => {
          if (prev.size > 0) {
            // If we have selections, clicking without modifiers clears selection and selects the new one
            lastClickedBookIdRef.current = book.id;
            return new Set([book.id]);
          } else {
            shouldOpen = true;
            return prev;
          }
        });

        if (shouldOpen) {
          onBookSelect?.(book);
        }
      }
    },
    [toggleSelection],
  );

  const value = useMemo(
    () => ({
      selectedBookIds,
      toggleSelection,
      setSelection: setSelectedBookIds,
      clearSelection,
      handleSelectionClick,
    }),
    [selectedBookIds, toggleSelection, clearSelection, handleSelectionClick],
  );

  return <BookSelectionContext.Provider value={value}>{children}</BookSelectionContext.Provider>;
}
