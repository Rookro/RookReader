import AutoAwesomeMotion from "@mui/icons-material/AutoAwesomeMotion";
import Delete from "@mui/icons-material/Delete";
import LibraryBooks from "@mui/icons-material/LibraryBooks";
import LocalOffer from "@mui/icons-material/LocalOffer";
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookWithState } from "../../../domain/book/schema";
import { useBookSelection } from "../hooks/useBookSelection";
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
  const { selectedBookIds } = useBookSelection();
  const { openDialog, getSelectedBooks } = useBookshelfActions();

  // Acting on a selected book means acting on the whole selection.
  const getTargetBooks = () => (selectedBookIds.has(book.id) ? getSelectedBooks() : [book]);

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
          <AutoAwesomeMotion sx={{ color: "text.secondary" }} />
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
        <ListItemText>
          {t("bookshelf.remove-book", { count: getTargetBooks().length })}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}
