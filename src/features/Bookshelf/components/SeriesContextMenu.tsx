import { Delete } from "@mui/icons-material";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import { updateBookSeries } from "../../../bindings/BookCommands";
import type { BookWithState, Series } from "../../../types/DatabaseModels";
import { useBookshelfActions } from "./BookshelfActionsContext";

export interface SeriesContextMenuProps {
  /** The series associated with this menu */
  series: Series;
  /** The books in this series */
  books: BookWithState[];
  /** Context menu anchor position */
  anchor: { mouseX: number; mouseY: number } | null;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Context menu for a series card.
 * Handles series-specific actions like removing the series relationship.
 */
export default function SeriesContextMenu({
  series: _series,
  books,
  anchor,
  onClose,
}: SeriesContextMenuProps) {
  const { t } = useTranslation();
  const { refreshSeries } = useBookshelfActions();

  const handleRemoveSeries = async () => {
    if (books.length === 0) {
      onClose();
      return;
    }
    try {
      const promises = books.map((b) => updateBookSeries(b.id, null));
      await Promise.all(promises);
      refreshSeries();
      onClose();
    } catch (e) {
      console.error(`Failed to remove series: ${e}`);
    }
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
      <MenuItem dense onClick={handleRemoveSeries}>
        <ListItemIcon>
          <Delete color="error" />
        </ListItemIcon>
        <ListItemText>{t("bookshelf.series.ungroup-series")}</ListItemText>
      </MenuItem>
    </Menu>
  );
}
