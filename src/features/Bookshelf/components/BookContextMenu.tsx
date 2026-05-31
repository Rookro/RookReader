import { CollectionsBookmark, Delete, LibraryBooks, LocalOffer } from "@mui/icons-material";
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookWithState } from "../../../domain/book/schema";
import { useBookshelfActions } from "./BookshelfActionsContext";

export interface BookContextMenuProps {
  /** The book associated with this menu */
  book: BookWithState;
  /** Currently selected books (optional, for multi-select actions) */
  selectedBooks?: BookWithState[];
  /** Context menu anchor position */
  anchor: { mouseX: number; mouseY: number } | null;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Context menu for a single book card.
 */
export default function BookContextMenu({
  book,
  selectedBooks = [],
  anchor,
  onClose,
}: BookContextMenuProps) {
  const { t } = useTranslation();
  const { openDialog } = useBookshelfActions();

  const getTargetBooks = () => {
    // If the book is part of the current selection, apply action to all selected books.
    // Otherwise, apply only to this book.
    const isSelected = selectedBooks.some((b) => b.id === book.id);
    return isSelected ? selectedBooks : [book];
  };

  return (
    <Menu
      open={anchor !== null}
      onClose={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      anchorReference="anchorPosition"
      anchorPosition={anchor !== null ? { top: anchor.mouseY, left: anchor.mouseX } : undefined}
    >
      <MenuItem
        dense
        onClick={() => {
          openDialog("add-to-bookshelf", getTargetBooks());
          onClose();
        }}
      >
        <ListItemIcon>
          <LibraryBooks sx={{ color: "text.secondary" }} />
        </ListItemIcon>
        <ListItemText>{t("bookshelf.collection.add-books-title")}</ListItemText>
      </MenuItem>
      <MenuItem
        dense
        onClick={() => {
          openDialog("set-series", getTargetBooks());
          onClose();
        }}
      >
        <ListItemIcon>
          <CollectionsBookmark sx={{ color: "text.secondary" }} />
        </ListItemIcon>
        <ListItemText>{t("bookshelf.series.set-series")}</ListItemText>
      </MenuItem>
      <MenuItem
        dense
        onClick={() => {
          openDialog("set-tags", getTargetBooks());
          onClose();
        }}
      >
        <ListItemIcon>
          <LocalOffer sx={{ color: "text.secondary" }} />
        </ListItemIcon>
        <ListItemText>{t("bookshelf.tag.set-tags")}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        dense
        onClick={() => {
          openDialog("delete-books", getTargetBooks());
          onClose();
        }}
      >
        <ListItemIcon>
          <Delete color="error" />
        </ListItemIcon>
        <ListItemText>{t("bookshelf.remove-book")}</ListItemText>
      </MenuItem>
    </Menu>
  );
}
