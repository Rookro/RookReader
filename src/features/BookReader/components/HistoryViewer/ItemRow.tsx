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
import { type CSSProperties, memo, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ContextMenu, {
  type ContextMenuCloseReason,
} from "../../../../components/ui/ContextMenu/ContextMenu";
import { useContextMenuAnchor } from "../../../../components/ui/ContextMenu/useContextMenuAnchor";
import type { BookWithState } from "../../../../domain/entities";
import { useAfterCommit } from "../../../../hooks/useAfterCommit";
import { useRowTooltip } from "../../../../hooks/useRowTooltip";
import { useAppDispatch } from "../../../../store/store";
import { preventRightClickFocus } from "../../../../utils/preventRightClickFocus";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";
import { clearHistory } from "../../../History/slice";
import { useSidePaneFocus } from "../../../SidePane/SidePaneFocusContext";

/**
 * Row component for the history viewer.
 *
 * @param entry - The history entry to display.
 * @param index - The index of the entry in the list.
 * @param selected - Whether the entry is selected.
 * @param id - Optional id, which the listbox's `aria-activedescendant` points at.
 * @param keyboardActive - Whether the row is drawn as the keyboard's active row.
 * @param onClick - Optional callback for when the entry is clicked.
 * @param registerMenu - Optional registration of the row's menu opener, for the context-menu key.
 * @param style - Optional CSS style for the row.
 */
export const ItemRow = memo(function ItemRow({
  entry,
  index,
  selected,
  id,
  keyboardActive,
  onClick,
  registerMenu,
  style,
}: {
  entry: BookWithState;
  index: number;
  selected: boolean;
  id?: string;
  keyboardActive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>, entry: BookWithState, index: number) => void;
  registerMenu?: (key: number, openAt: (row: HTMLElement) => void) => () => void;
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
  const { anchor: contextMenu, open: handleContextMenu, openAt, close } = useContextMenuAnchor();
  const { requestPanelFocus, returnToReader } = useSidePaneFocus();
  const afterCommit = useAfterCommit();
  const fromKeyboard = contextMenu?.fromKeyboard === true;
  const tooltip = useRowTooltip(keyboardActive === true);

  useEffect(() => registerMenu?.(entry.id, openAt), [registerMenu, entry.id, openAt]);

  const handleMenuClosed = useCallback(
    (reason: ContextMenuCloseReason) => {
      close();
      if (fromKeyboard && (reason === "escapeKeyDown" || reason === "tabKeyDown")) {
        afterCommit(() => requestPanelFocus("active"));
      }
    },
    [close, fromKeyboard, afterCommit, requestPanelFocus],
  );

  const handleOpenClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>, entry: BookWithState, index: number) => {
      close();
      if (fromKeyboard && e.detail === 0) {
        returnToReader();
      }
      onClick?.(e, entry, index);
    },
    [onClick, close, fromKeyboard, returnToReader],
  );

  const handleRemoveClicked = useCallback(
    async (e: React.MouseEvent<HTMLElement>, entry: BookWithState, _index: number) => {
      close();
      dispatch(clearHistory(entry.id));
      if (fromKeyboard && e.detail === 0) {
        afterCommit(() => requestPanelFocus("active"));
      }
    },
    [dispatch, close, fromKeyboard, afterCommit, requestPanelFocus],
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
        placement="right-start"
        {...tooltip}
      >
        <ListItem style={style} key={index} component="div" role="none" disablePadding dense>
          <ListItemButton
            id={id}
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            className={keyboardActive ? "Mui-focusVisible" : undefined}
            selected={selected}
            onClick={(e) => {
              releaseMouseFocus(e);
              onClick?.(e, entry, index);
            }}
            onMouseDown={preventRightClickFocus}
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
