import FolderOutlined from "@mui/icons-material/FolderOutlined";
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { type CSSProperties, memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ContextMenu from "../../../../components/ui/ContextMenu/ContextMenu";
import { useContextMenuAnchor } from "../../../../components/ui/ContextMenu/useContextMenuAnchor";
import type { BookWithState } from "../../../../domain/entities";
import { useAppDispatch } from "../../../../store/store";
import { clearHistory } from "../../../History/slice";

/**
 * Row component for the history viewer.
 *
 * @param entry - The history entry to display.
 * @param index - The index of the entry in the list.
 * @param selected - Whether the entry is selected.
 * @param onClick - Optional callback for when the entry is clicked.
 * @param style - Optional CSS style for the row.
 */
export const ItemRow = memo(function ItemRow({
  entry,
  index,
  selected,
  onClick,
  style,
}: {
  entry: BookWithState;
  index: number;
  selected: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>, entry: BookWithState, index: number) => void;
  style?: CSSProperties;
}) {
  const { t, i18n } = useTranslation();

  const lastOpenedAt = useMemo(() => {
    const stored = entry.lastOpenedAt;
    if (!stored) {
      return "";
    }
    const parsed = new Date(stored);
    return Number.isNaN(parsed.getTime()) ? stored : parsed.toLocaleString(i18n.language);
  }, [entry.lastOpenedAt, i18n.language]);
  const dispatch = useAppDispatch();
  const {
    anchor: contextMenu,
    open: handleContextMenu,
    close: handleMenuClosed,
  } = useContextMenuAnchor();

  const handleOpenClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>, entry: BookWithState, index: number) => {
      handleMenuClosed();
      onClick?.(e, entry, index);
    },
    [onClick, handleMenuClosed],
  );

  const handleRemoveClicked = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, entry: BookWithState, _index: number) => {
      handleMenuClosed();
      dispatch(clearHistory(entry.id));
    },
    [dispatch, handleMenuClosed],
  );

  return (
    <Box component="div" onContextMenu={handleContextMenu}>
      <Tooltip
        title={
          <>
            <Typography variant="inherit">{entry.filePath}</Typography>
            <Typography variant="inherit">
              {t("book-reader.history-viewer.last-opened-at", { date: lastOpenedAt })}
            </Typography>
          </>
        }
        followCursor
        placement="right-start"
      >
        <ListItem style={style} key={index} component="div" disablePadding dense>
          <ListItemButton
            selected={selected}
            onClick={(e) => onClick?.(e, entry, index)}
            key={index}
            sx={{ padding: "4px 8px" }}
          >
            <ListItemText primary={entry.displayName} slotProps={{ primary: { noWrap: true } }} />
            {entry.itemType === "directory" && <FolderOutlined fontSize="small" />}
          </ListItemButton>
        </ListItem>
      </Tooltip>
      <ContextMenu anchor={contextMenu} onClose={handleMenuClosed}>
        <MenuItem onClick={(e) => handleOpenClicked(e, entry, index)}>
          {t("book-reader.history-viewer.menu.open")}
        </MenuItem>
        <MenuItem onClick={(e) => handleRemoveClicked(e, entry, index)}>
          {t("book-reader.history-viewer.menu.remove")}
        </MenuItem>
      </ContextMenu>
    </Box>
  );
});
