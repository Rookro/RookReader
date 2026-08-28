import LinkOff from "@mui/icons-material/LinkOff";
import Sort from "@mui/icons-material/Sort";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteSeries } from "../../../bindings/SeriesCommands";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import type { Series } from "../../../domain/series/schema";
import { useAppDispatch } from "../../../store/store";
import { setEditSeriesOrderDialogState } from "../seriesSlice";

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
  const dispatch = useAppDispatch();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Ungrouping cannot be undone, so confirm before calling the backend.
  const handleRemoveSeriesRequested = () => {
    setIsConfirmOpen(true);
    onClose();
  };

  const handleRemoveSeriesConfirmed = async () => {
    setIsConfirmOpen(false);
    try {
      await deleteSeries(series.id);
    } catch (e) {
      error(`Failed to remove series: ${e}`);
    }
  };

  const handleEditOrder = () => {
    dispatch(setEditSeriesOrderDialogState({ isOpen: true, seriesId: series.id }));
    onClose();
  };

  return (
    <>
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
        <MenuItem dense onClick={handleEditOrder}>
          <ListItemIcon>
            <Sort />
          </ListItemIcon>
          <ListItemText>{t("bookshelf.series.edit-order.title")}</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={handleRemoveSeriesRequested}>
          <ListItemIcon>
            <LinkOff />
          </ListItemIcon>
          <ListItemText>{t("bookshelf.series.ungroup-series")}</ListItemText>
        </MenuItem>
      </Menu>
      <ConfirmDialog
        open={isConfirmOpen}
        title={t("bookshelf.series.ungroup-confirm.title")}
        description={t("bookshelf.series.ungroup-confirm.description", { name: series.name })}
        confirmLabel={t("bookshelf.series.ungroup-series")}
        onConfirm={handleRemoveSeriesConfirmed}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
