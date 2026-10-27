import LibraryBooks from "@mui/icons-material/LibraryBooks";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getBookshelvesForBook } from "../../../../bindings/BookshelfCommands";
import type { Bookshelf } from "../../../../domain/bookshelf/schema";
import { useAppDispatch } from "../../../../store/store";
import { useBookCheckStates } from "../../hooks/useBookCheckStates";
import { setBookshelvesForBooks } from "../../slice";
import { BookShelfIcons } from "../BookshelfIcons";

/** Props for the SetBookshelvesDialog component */
export interface SetBookshelvesDialogProps {
  /** Whether the dialog is open or closed. */
  open: boolean;
  /** The IDs of the books whose bookshelves are being set. */
  bookIds: number[];
  /** The available bookshelves to choose from. */
  availableBookshelves: Bookshelf[];
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for setting the bookshelves that contain books */
export default function SetBookshelvesDialog({
  open,
  bookIds,
  availableBookshelves,
  onClose,
}: SetBookshelvesDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { stateOf, toggle, changes } = useBookCheckStates({
    open,
    bookIds,
    ids: availableBookshelves.map((bookshelf) => bookshelf.id),
    load: getBookshelvesForBook,
    loadErrorMessage: "Failed to fetch bookshelves for books",
  });

  const handleSave = useCallback(async () => {
    if (bookIds.length === 0 || changes?.length === 0) {
      onClose();
      return;
    }
    if (changes === null) return;
    const result = await dispatch(
      setBookshelvesForBooks(changes.map(({ bookId, ids }) => ({ bookId, bookshelfIds: ids }))),
    );
    // On failure the slice error is shown by GlobalErrorListener and the backend's
    // `books-changed` refetch reflects any partial success; stay open for retry.
    if (setBookshelvesForBooks.fulfilled.match(result)) {
      onClose();
    }
  }, [bookIds, changes, dispatch, onClose]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{t("bookshelf.collection.set-title")}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            maxHeight: 300,
            overflowY: "auto",
            overflowX: "hidden",
            paddingX: 2,
          }}
        >
          <List disablePadding>
            {availableBookshelves.map((bookshelf) => {
              const icon = BookShelfIcons.find((i) => i.key === bookshelf.icon_id)?.icon ?? (
                <LibraryBooks color="action" />
              );
              return (
                <ListItem key={bookshelf.id} disablePadding>
                  <ListItemIcon
                    sx={{ minWidth: "auto", marginRight: "12px", color: "text.secondary" }}
                  >
                    {icon}
                  </ListItemIcon>
                  <ListItemText
                    id={`checkbox-bookshelf-list-label-${bookshelf.id}`}
                    primary={bookshelf.name}
                  />
                  <Checkbox
                    edge="end"
                    onChange={() => toggle(bookshelf.id)}
                    checked={stateOf(bookshelf.id) === "checked"}
                    indeterminate={stateOf(bookshelf.id) === "mixed"}
                  />
                </ListItem>
              );
            })}
            {availableBookshelves.length === 0 && (
              <ListItem>
                <ListItemText primary={t("bookshelf.collection.no-collections-available")} />
              </ListItem>
            )}
          </List>
        </Box>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.collection.cancel-button")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={bookIds.length > 0 && changes === null}
        >
          {t("bookshelf.collection.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
