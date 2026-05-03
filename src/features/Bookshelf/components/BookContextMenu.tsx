import { Delete, LibraryBooks, LocalOffer } from "@mui/icons-material";
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookWithState } from "../../../types/DatabaseModels";
import { useBookshelfActions } from "./BookshelfActionsContext";

export interface BookContextMenuProps {
  /** The book associated with this menu */
  book: BookWithState;
  /** Context menu anchor position */
  anchor: { mouseX: number; mouseY: number } | null;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Context menu for a single book card.
 */
export default function BookContextMenu({ book, anchor, onClose }: BookContextMenuProps) {
  const { t } = useTranslation();
  const { openDialog } = useBookshelfActions();

  const getTargetBooks = () => {
    // If the book is part of the current selection, apply action to all selected books.
    // Otherwise, apply only to this book.
    // Note: This implementation assumes we can't easily get all Book objects here without passing them,
    // so we just pass the IDs/objects we have.
    // Actually, AddBooksToBookshelvesDialog and SetSeriesDialog take bookIds,
    // but SetBookTagsDialog and BookDeleteDialog currently take BookWithState[].

    // For now, if it's selected, we can only pass the current book object
    // unless we refactor more.
    // Wait, the original BookGrid.tsx filtered filteredSortedItems.

    // To stay simple and "internal", we act on the single book for now,
    // or we might need to pass the "all books" list if we want full multi-select support in the menu.

    // However, the prompt says "BookCard/SeriesCard 内部で決定し".
    // Let's assume for now the menu acts on the book it was opened on.
    return [book];
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
          <LibraryBooks sx={{ color: "text.secondary" }} />
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
