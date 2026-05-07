import { Delete } from "@mui/icons-material";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { useTranslation } from "react-i18next";
import { deleteSeries } from "../../../bindings/SeriesCommand";
import type { Series } from "../../../types/DatabaseModels";
import { useBookshelfActions } from "./BookshelfActionsContext";

export interface SeriesContextMenuProps {
  /** The series associated with this menu */
  series: Series;
  /** Context menu anchor position */
  anchor: { mouseX: number; mouseY: number } | null;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Context menu for a series card.
 * Handles series-specific actions like removing the series relationship.
 */
export default function SeriesContextMenu({ series, anchor, onClose }: SeriesContextMenuProps) {
  const { t } = useTranslation();
  const { refreshSeries } = useBookshelfActions();

  const handleRemoveSeries = async () => {
    try {
      await deleteSeries(series.id);
      refreshSeries();
      onClose();
    } catch (e) {
      error(`Failed to remove series: ${e}`);
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
