import { CSSProperties, memo, useCallback, useState } from "react";
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { FolderOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "../../../../store/store";
import { ReadBook } from "../../../../types/DatabaseModels";
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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();

    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX,
            mouseY: event.clientY,
          }
        : null,
    );
  };

  const handleMenuClosed = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOpenClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>, entry: ReadBook, index: number) => {
      setContextMenu(null);
      onClick?.(e, entry, index);
    },
    [onClick],
  );

  const handleRemoveClicked = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, entry: ReadBook, _index: number) => {
      setContextMenu(null);
      dispatch(clearHistory(entry.id));
    },
    [dispatch],
  );

  return (
    <Box component="div" onContextMenu={handleContextMenu}>
      <Tooltip
        title={
          <>
            <Typography variant="inherit">{entry.file_path}</Typography>
            <Typography variant="inherit">{entry.last_opened_at}</Typography>
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
            {entry.item_type === "directory" ? <FolderOutlined fontSize="small" /> : <></>}
          </ListItemButton>
        </ListItem>
      </Tooltip>
      <Menu
        open={contextMenu !== null}
        onClose={handleMenuClosed}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        slotProps={{ list: { dense: true } }}
      >
        <MenuItem onClick={(e) => handleOpenClicked(e, entry, index)}>
          {t("book-reader.history-viewer.menu.open")}
        </MenuItem>
        <MenuItem onClick={(e) => handleRemoveClicked(e, entry, index)}>
          {t("book-reader.history-viewer.menu.remove")}
        </MenuItem>
      </Menu>
    </Box>
  );
});
