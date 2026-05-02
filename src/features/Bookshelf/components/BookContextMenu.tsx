import { Delete, LibraryBooks, LocalOffer } from "@mui/icons-material";
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookWithState } from "../../../types/DatabaseModels";

interface BookContextMenuProps {
  /** Context menu state (position and book) */
  anchor: { mouseX: number; mouseY: number; book: BookWithState } | null;
  /** Callback to close the menu */
  onClose: () => void;
  /** Callback to open add to bookshelf dialog */
  onAddToBookshelf: (book: BookWithState) => void;
  /** Callback to open tags dialog */
  onSetTags: (book: BookWithState) => void;
  /** Callback to open delete dialog */
  onDelete: (book: BookWithState) => void;
}

/**
 * Context menu for a book in the grid.
 */
export default function BookContextMenu({
  anchor,
  onClose,
  onAddToBookshelf,
  onSetTags,
  onDelete,
}: BookContextMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu
      open={anchor !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchor !== null ? { top: anchor.mouseY, left: anchor.mouseX } : undefined}
    >
      <MenuItem
        dense
        onClick={() => {
          if (anchor) onAddToBookshelf(anchor.book);
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
          if (anchor) onSetTags(anchor.book);
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
          if (anchor) onDelete(anchor.book);
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
