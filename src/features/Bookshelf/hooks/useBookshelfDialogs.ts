import { useCallback, useMemo, useState } from "react";
import type { BookWithState } from "../../../domain/book/schema";

/** Dialogs that act on a set of books. */
export type BookDialogType = "add-to-bookshelf" | "set-tags" | "set-series" | "delete-books";

/** Every dialog hosted by the book grid. */
export type BookshelfDialogType = BookDialogType | "edit-series-order" | null;

interface BookshelfDialogState {
  type: BookshelfDialogType;
  /** Target books of a book dialog; kept after close so the closing animation has content. */
  books: BookWithState[];
  /** Target series of the edit-order dialog. */
  seriesId: number | null;
}

/** Owns which bookshelf dialog is open and what it targets. */
export function useBookshelfDialogs() {
  const [state, setState] = useState<BookshelfDialogState>({
    type: null,
    books: [],
    seriesId: null,
  });

  const openDialog = useCallback((type: BookDialogType, books: BookWithState[]) => {
    setState({ type, books, seriesId: null });
  }, []);

  const openEditSeriesOrderDialog = useCallback((seriesId: number) => {
    setState({ type: "edit-series-order", books: [], seriesId });
  }, []);

  const closeDialog = useCallback(() => {
    setState((prev) => ({ ...prev, type: null }));
  }, []);

  const dialogBookIds = useMemo(() => state.books.map((b) => b.id), [state.books]);

  return {
    dialogType: state.type,
    dialogBooks: state.books,
    dialogBookIds,
    editSeriesOrderSeriesId: state.seriesId,
    openDialog,
    openEditSeriesOrderDialog,
    closeDialog,
  };
}
