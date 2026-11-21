import { Box, ListItem, ListItemButton, ListItemText, MenuItem } from "@mui/material";
import { memo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ContextMenu, {
  type ContextMenuCloseReason,
} from "../../../../components/ui/ContextMenu/ContextMenu";
import { useContextMenuAnchor } from "../../../../components/ui/ContextMenu/useContextMenuAnchor";
import type { Bookmark } from "../../../../domain/entities";
import { useAfterCommit } from "../../../../hooks/useAfterCommit";
import { preventRightClickFocus } from "../../../../utils/preventRightClickFocus";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";
import { useSidePaneFocus } from "../../../SidePane/SidePaneFocusContext";

/**
 * Row component for the bookmark viewer.
 *
 * @param bookmark - The bookmark to display.
 * @param id - Optional id, which the listbox's `aria-activedescendant` points at.
 * @param keyboardActive - Whether the row is drawn as the keyboard's active row.
 * @param onJump - Callback invoked to navigate to the bookmark.
 * @param onRename - Callback invoked to start renaming the bookmark, told whether Rename was
 *   chosen with the keyboard.
 * @param onRemove - Callback invoked to delete the bookmark.
 * @param registerMenu - Optional registration of the row's menu opener, for the context-menu key.
 */
export const ItemRow = memo(function ItemRow({
  bookmark,
  id,
  keyboardActive,
  onJump,
  onRename,
  onRemove,
  registerMenu,
}: {
  bookmark: Bookmark;
  id?: string;
  keyboardActive?: boolean;
  onJump: (bookmark: Bookmark) => void;
  onRename: (bookmark: Bookmark, byKeyboard: boolean) => void;
  onRemove: (bookmark: Bookmark) => void;
  registerMenu?: (key: number, openAt: (row: HTMLElement) => void) => () => void;
}) {
  const { t } = useTranslation();
  const { anchor: contextMenu, open: handleContextMenu, openAt, close } = useContextMenuAnchor();
  const { requestPanelFocus, returnToReader } = useSidePaneFocus();
  const afterCommit = useAfterCommit();
  const fromKeyboard = contextMenu?.fromKeyboard === true;

  useEffect(() => registerMenu?.(bookmark.id, openAt), [registerMenu, bookmark.id, openAt]);

  const handleMenuClosed = useCallback(
    (reason: ContextMenuCloseReason) => {
      close();
      if (fromKeyboard && (reason === "escapeKeyDown" || reason === "tabKeyDown")) {
        afterCommit(() => requestPanelFocus("active"));
      }
    },
    [close, fromKeyboard, afterCommit, requestPanelFocus],
  );

  const handleJumpClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      close();
      if (fromKeyboard && e.detail === 0) {
        returnToReader();
      }
      onJump(bookmark);
    },
    [onJump, bookmark, close, fromKeyboard, returnToReader],
  );

  const handleRenameClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      close();
      onRename(bookmark, fromKeyboard && e.detail === 0);
    },
    [onRename, bookmark, close, fromKeyboard],
  );

  const handleRemoveClicked = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      close();
      onRemove(bookmark);
      if (fromKeyboard && e.detail === 0) {
        afterCommit(() => requestPanelFocus("active"));
      }
    },
    [onRemove, bookmark, close, fromKeyboard, afterCommit, requestPanelFocus],
  );

  return (
    <Box component="div" onContextMenu={handleContextMenu}>
      <ListItem component="div" role="none" disablePadding dense>
        <ListItemButton
          id={id}
          role="option"
          aria-selected={false}
          tabIndex={-1}
          className={keyboardActive ? "Mui-focusVisible" : undefined}
          onClick={(e) => {
            releaseMouseFocus(e);
            handleJumpClicked(e);
          }}
          onMouseDown={preventRightClickFocus}
          sx={{ padding: "4px 8px" }}
        >
          <ListItemText
            primary={bookmark.name}
            secondary={t("book-reader.bookmark-viewer.page-caption", {
              page: bookmark.pageIndex + 1,
            })}
            slotProps={{ primary: { noWrap: true }, secondary: { variant: "caption" } }}
          />
        </ListItemButton>
      </ListItem>
      <ContextMenu anchor={contextMenu} onClose={handleMenuClosed}>
        <MenuItem onClick={handleJumpClicked}>
          {t("book-reader.bookmark-viewer.menu.jump")}
        </MenuItem>
        <MenuItem onClick={handleRenameClicked}>
          {t("book-reader.bookmark-viewer.menu.rename")}
        </MenuItem>
        <MenuItem onClick={handleRemoveClicked}>
          {t("book-reader.bookmark-viewer.menu.remove")}
        </MenuItem>
      </ContextMenu>
    </Box>
  );
});
