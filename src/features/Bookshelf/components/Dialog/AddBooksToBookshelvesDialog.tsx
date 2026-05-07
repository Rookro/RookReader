import { LibraryBooks } from "@mui/icons-material";
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
import { error as logError } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addBookToBookshelf } from "../../../../bindings/BookshelfCommand";
import type { Bookshelf } from "../../../../types/DatabaseModels";
import { BookShelfIcons } from "../BookshelfIcons";

/** Props for the AddBooksToBookshelvesDialog component */
export interface AddBooksToBookshelvesDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** The IDs of the books to add. */
  bookIds: number[];
  /** The available bookshelves to choose from. */
  availableBookshelves: Bookshelf[];
  /** Callback after successfully adding books to the selected bookshelves. */
  onAddBooks: () => void;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for adding books to one or more bookshelves */
export default function AddBooksToBookshelvesDialog({
  openDialog,
  bookIds,
  availableBookshelves,
  onAddBooks,
  onClose,
}: AddBooksToBookshelvesDialogProps) {
  const { t } = useTranslation();
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
    try {
      const bookshelfIdsArray = Array.from(selectedBookshelfIds);
      const promises = [];

      // Iterate over each book and each selected bookshelf
      for (const bookId of bookIds) {
        for (const bookshelfId of bookshelfIdsArray) {
          promises.push(addBookToBookshelf(bookshelfId, bookId));
        }
      }

      await Promise.all(promises);
      onAddBooks();
      onClose();
    } catch (e) {
      logError(`Failed to add books to bookshelves: ${e}`);
    }
  }, [bookIds, selectedBookshelfIds, onAddBooks, onClose]);

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
