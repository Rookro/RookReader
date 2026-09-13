import { createContext, useContext } from "react";
import type { BookWithState } from "../../../domain/book/schema";
import type { BookDialogType } from "../hooks/useBookshelfDialogs";

export interface BookshelfActions {
  /** Opens a specific dialog for a set of books */
  openDialog: (type: BookDialogType, books: BookWithState[]) => void;
  /** Opens the Edit Series Order dialog for a series */
  openEditSeriesOrderDialog: (seriesId: number) => void;
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
