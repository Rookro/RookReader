import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { BookWithState } from "../../../types/DatabaseModels";
import { Trans, useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../Store";
import { deleteBookFromCollection } from "../../../reducers/BookCollectionReducer";
import { useCallback } from "react";

/** Props for the BookDeleteDialog component. */
export interface BookDeleteDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** The book to delete. */
  book: BookWithState | null;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for deleting a book from a bookshelf. */
export default function BookDeleteDialog({ openDialog, book, onClose }: BookDeleteDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { bookshelves, selectedId } = useAppSelector((state) => state.bookCollection.bookshelf);

  const handleDelete = useCallback(async () => {
    if (book) {
      await dispatch(deleteBookFromCollection({ bookId: book.id, bookshelfId: selectedId }));
    }
    onClose();
  }, [book, dispatch, onClose, selectedId]);

  return (
    <Dialog open={openDialog} onClose={onClose}>
      <DialogTitle>{t("bookshelf.book-deletion.title")}</DialogTitle>

      <DialogContent>
        <DialogContentText>
          <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
            <Trans
              i18nKey="bookshelf.book-deletion.description"
              values={{
                bookName: book?.display_name,
                bookshelfName:
                  bookshelves.find((shelf) => shelf.id === selectedId)?.name ??
                  t("bookshelf.collection.all-books"),
              }}
              components={{
                bold: <Box component="span" fontWeight="bold" color="text.primary" />,
              }}
            />
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
