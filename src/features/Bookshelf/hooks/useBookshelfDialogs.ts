import { useCallback, useState } from "react";
import type { BookWithState } from "../../../types/DatabaseModels";

/** Types of dialogs available in the bookshelf */
export type BookshelfDialogType = "add-to-bookshelf" | "set-tags" | "delete-books" | null;

/** State for managing bookshelf dialogs */
interface BookshelfDialogState {
  type: BookshelfDialogType;
  selectedBookIds: number[];
  selectedBooks: BookWithState[];
}

/**
 * Hook for managing the state of multiple dialogs in the bookshelf.
 */
export function useBookshelfDialogs() {
  const [dialogState, setDialogState] = useState<BookshelfDialogState>({
    type: null,
    selectedBookIds: [],
    selectedBooks: [],
  });

  const openDialog = useCallback((type: BookshelfDialogType, books: BookWithState[]) => {
    setDialogState({
      type,
      selectedBookIds: books.map((b) => b.id),
      selectedBooks: books,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, type: null }));
  }, []);

  // Specifically for clearing data after close animations if needed,
  // but usually resetting type to null is enough for "open" prop.
  const clearDialogData = useCallback(() => {
    setDialogState({
      type: null,
      selectedBookIds: [],
      selectedBooks: [],
    });
  }, []);

  return {
    dialogType: dialogState.type,
    selectedBookIds: dialogState.selectedBookIds,
    selectedBooks: dialogState.selectedBooks,
    openDialog,
    closeDialog,
    clearDialogData,
  };
}
