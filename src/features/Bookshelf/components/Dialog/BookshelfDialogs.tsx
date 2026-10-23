import type { BookWithState } from "../../../../domain/book/schema";
import { useAppSelector } from "../../../../store/store";
import type { BookshelfDialogType } from "../../hooks/useBookshelfDialogs";
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
  const availableBookshelves = useAppSelector((state) => state.bookCollection.bookshelves);
  const availableTags = useAppSelector((state) => state.tag.tags);
  const availableSeries = useAppSelector((state) => state.series.series);

  return (
    <>
      <AddBooksToBookshelvesDialog
        open={dialogType === "add-to-bookshelf"}
        bookIds={dialogBookIds}
        availableBookshelves={availableBookshelves}
        onClose={onBookDialogClose}
      />
      <SetBookTagsDialog
        open={dialogType === "set-tags"}
        bookIds={dialogBookIds}
        availableTags={availableTags}
        onClose={onBookDialogClose}
      />
      <SetSeriesDialog
        open={dialogType === "set-series"}
        books={dialogBooks}
        availableSeries={availableSeries}
        onClose={onBookDialogClose}
      />
      <BookDeleteDialog
        open={dialogType === "delete-books"}
        books={dialogBooks}
        onClose={onBookDialogClose}
      />
      <EditSeriesOrderDialog
        open={dialogType === "edit-series-order"}
        seriesId={editSeriesOrderSeriesId}
        onClose={onEditSeriesOrderClose}
      />
    </>
  );
}
