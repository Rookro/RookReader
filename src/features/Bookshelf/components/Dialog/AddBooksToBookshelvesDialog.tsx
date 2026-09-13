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
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Bookshelf } from "../../../../domain/bookshelf/schema";
import { useAppDispatch } from "../../../../store/store";
import { addBooksToBookshelves } from "../../slice";
import { BookShelfIcons } from "../BookshelfIcons";

/** Props for the AddBooksToBookshelvesDialog component */
export interface AddBooksToBookshelvesDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** The IDs of the books to add. */
  bookIds: number[];
  /** The available bookshelves to choose from. */
  availableBookshelves: Bookshelf[];
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for adding books to one or more bookshelves */
export default function AddBooksToBookshelvesDialog({
  openDialog,
  bookIds,
  availableBookshelves,
  onClose,
}: AddBooksToBookshelvesDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [selectedBookshelfIds, setSelectedBookshelfIds] = useState<Set<number>>(new Set());

  // Always reset selection when dialog opens
  useEffect(() => {
    if (openDialog) {
      setSelectedBookshelfIds(new Set());
    }
  }, [openDialog]);

  const handleToggle = useCallback(
    (bookshelfId: number) => {
      const newSelected = new Set(selectedBookshelfIds);
      if (newSelected.has(bookshelfId)) {
        newSelected.delete(bookshelfId);
      } else {
        newSelected.add(bookshelfId);
      }
      setSelectedBookshelfIds(newSelected);
    },
    [selectedBookshelfIds],
  );

  const handleSave = useCallback(async () => {
    if (bookIds.length === 0 || selectedBookshelfIds.size === 0) {
      onClose();
      return;
    }
    const result = await dispatch(
      addBooksToBookshelves({ bookIds, bookshelfIds: Array.from(selectedBookshelfIds) }),
    );
    // On failure the slice error is shown by GlobalErrorListener and the backend's
    // `history-changed` refetch reflects any partial success; stay open for retry.
    if (addBooksToBookshelves.fulfilled.match(result)) {
      onClose();
    }
  }, [bookIds, selectedBookshelfIds, dispatch, onClose]);

  return (
    <Dialog open={openDialog} onClose={onClose} fullWidth>
      <DialogTitle>{t("bookshelf.collection.add-books-title")}</DialogTitle>
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
                    onChange={() => handleToggle(bookshelf.id)}
                    checked={selectedBookshelfIds.has(bookshelf.id)}
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
        <Button variant="contained" onClick={handleSave} disabled={selectedBookshelfIds.size === 0}>
          {t("bookshelf.collection.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
