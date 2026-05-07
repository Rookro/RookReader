import { createContext, useContext } from "react";
import type { BookWithState } from "../../../types/DatabaseModels";
import type { BookshelfDialogType } from "../hooks/useBookshelfDialogs";

export interface BookshelfActions {
  /** Opens a specific dialog for a set of books */
  openDialog: (type: BookshelfDialogType, books: BookWithState[]) => void;
  /** Refreshes the books in the current bookshelf */
  refreshBookshelf: () => void;
  /** Refreshes the series list and the current bookshelf */
  refreshSeries: () => void;
}

export const BookshelfActionsContext = createContext<BookshelfActions | null>(null);

/** Hook to use bookshelf actions */
export function useBookshelfActions() {
  const context = useContext(BookshelfActionsContext);
  if (!context) {
    throw new Error("useBookshelfActions must be used within a BookshelfActionsProvider");
  }
  return context;
}
