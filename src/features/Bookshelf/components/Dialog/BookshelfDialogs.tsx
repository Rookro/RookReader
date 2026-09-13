import { useMemo } from "react";
import type { BookWithState } from "../../../../domain/book/schema";
import { useAppSelector } from "../../../../store/store";
import type { BookshelfDialogType } from "../../hooks/useBookshelfDialogs";
import { sortBySeriesOrder } from "../../utils/BookshelfUtils";
import AddBooksToBookshelvesDialog from "./AddBooksToBookshelvesDialog";
import BookDeleteDialog from "./BookDeleteDialog";
import EditSeriesOrderDialog from "./EditSeriesOrderDialog";
import SetBookTagsDialog from "./SetBookTagsDialog";
import SetSeriesDialog from "./SetSeriesDialog";

/** Props for the BookshelfDialogs component. */
export interface BookshelfDialogsProps {
  /** The dialog currently open, or null. */
  dialogType: BookshelfDialogType;
  /** The books a book dialog acts on. */
  dialogBooks: BookWithState[];
  /** The IDs of `dialogBooks`. */
  dialogBookIds: number[];
  /** The series the edit-order dialog acts on. */
  editSeriesOrderSeriesId: number | null;
  /** Closes a book dialog. */
  onBookDialogClose: () => void;
  /** Closes the edit-order dialog. */
  onEditSeriesOrderClose: () => void;
}

/** The dialogs opened from the book grid, keyed by the dialog type. */
export default function BookshelfDialogs({
  dialogType,
  dialogBooks,
  dialogBookIds,
  editSeriesOrderSeriesId,
  onBookDialogClose,
  onEditSeriesOrderClose,
}: BookshelfDialogsProps) {
  const books = useAppSelector((state) => state.bookCollection.books);
  const availableBookshelves = useAppSelector((state) => state.bookCollection.bookshelves);
  const availableTags = useAppSelector((state) => state.tag.tags);
  const availableSeries = useAppSelector((state) => state.series.series);

  const editSeriesOrderBooks = useMemo(() => {
    if (editSeriesOrderSeriesId === null) return [];
    return books.filter((b) => b.series_id === editSeriesOrderSeriesId).sort(sortBySeriesOrder);
  }, [books, editSeriesOrderSeriesId]);

  return (
    <>
      <AddBooksToBookshelvesDialog
        openDialog={dialogType === "add-to-bookshelf"}
        bookIds={dialogBookIds}
        availableBookshelves={availableBookshelves}
        onClose={onBookDialogClose}
      />
      <SetBookTagsDialog
        openDialog={dialogType === "set-tags"}
        bookIds={dialogBookIds}
        availableTags={availableTags}
        onClose={onBookDialogClose}
      />
      <SetSeriesDialog
        openDialog={dialogType === "set-series"}
        bookIds={dialogBookIds}
        availableSeries={availableSeries}
        onClose={onBookDialogClose}
      />
      <BookDeleteDialog
        openDialog={dialogType === "delete-books"}
        books={dialogBooks}
        onClose={onBookDialogClose}
      />
      <EditSeriesOrderDialog
        openDialog={dialogType === "edit-series-order"}
        books={editSeriesOrderBooks}
        onClose={onEditSeriesOrderClose}
      />
    </>
  );
}
