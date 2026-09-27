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
import type { ReadBook } from "../../../../domain/book/schema";
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
  entry: ReadBook;
  index: number;
  selected: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>, entry: ReadBook, index: number) => void;
  style?: CSSProperties;
}) {
  const { t, i18n } = useTranslation();

  // The backend stores this as a naive UTC timestamp with no offset, so mark it as
  // UTC before formatting it for the active locale.
  const lastOpenedAt = useMemo(() => {
    const parsed = new Date(`${entry.last_opened_at}Z`);
    return Number.isNaN(parsed.getTime())
      ? entry.last_opened_at
      : parsed.toLocaleString(i18n.language);
  }, [entry.last_opened_at, i18n.language]);
  const dispatch = useAppDispatch();
  const {
    anchor: contextMenu,
    open: handleContextMenu,
    close: handleMenuClosed,
  } = useContextMenuAnchor();

  const handleOpenClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>, entry: ReadBook, index: number) => {
      handleMenuClosed();
      onClick?.(e, entry, index);
    },
    [onClick, handleMenuClosed],
  );

  const handleRemoveClicked = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, entry: ReadBook, _index: number) => {
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
            <Typography variant="inherit">{entry.file_path}</Typography>
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
            <ListItemText primary={entry.display_name} slotProps={{ primary: { noWrap: true } }} />
            {entry.item_type === "directory" && <FolderOutlined fontSize="small" />}
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
