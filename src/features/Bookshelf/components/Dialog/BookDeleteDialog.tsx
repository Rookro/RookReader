import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import type { BookWithState } from "../../../../types/DatabaseModels";
import { deleteBookFromCollection } from "../../slice";

/** Props for the BookDeleteDialog component. */
export interface BookDeleteDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** The books to delete. */
  books: BookWithState[];
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for deleting books from a bookshelf. */
export default function BookDeleteDialog({ openDialog, books, onClose }: BookDeleteDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const bookshelves = useAppSelector((state) => state.bookCollection.bookshelf.bookshelves);
  const selectedId = useAppSelector((state) => state.bookCollection.bookshelf.selectedId);

  const handleDelete = useCallback(async () => {
    if (books.length > 0) {
      await Promise.all(
        books.map((b) =>
          dispatch(deleteBookFromCollection({ bookId: b.id, bookshelfId: selectedId })),
        ),
      );
    }
    onClose();
  }, [books, dispatch, onClose, selectedId]);

  const bookshelfName =
    bookshelves.find((shelf) => shelf.id === selectedId)?.name ??
    t("bookshelf.collection.all-books");

  return (
    <Dialog open={openDialog} onClose={onClose}>
      <DialogTitle>{t("bookshelf.book-deletion.title")}</DialogTitle>

      <DialogContent>
        <DialogContentText>
          <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
            {books.length === 1 ? (
              <Trans
                i18nKey="bookshelf.book-deletion.description"
                values={{
                  bookName: books[0].display_name,
                  bookshelfName,
                }}
                components={{
                  bold: <Box component="span" fontWeight="bold" color="text.primary" />,
                }}
              />
            ) : (
              <Trans
                i18nKey="bookshelf.book-deletion.description-multiple"
                values={{
                  count: books.length,
                  bookshelfName,
                }}
                components={{
                  bold: <Box component="span" fontWeight="bold" color="text.primary" />,
                }}
              />
            )}
          </Box>
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onClose} autoFocus sx={{ color: "text.secondary" }}>
          {t("bookshelf.book-deletion.cancel-button")}
        </Button>
        <Button onClick={handleDelete} color="error" variant="contained">
          {t("bookshelf.book-deletion.delete-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
