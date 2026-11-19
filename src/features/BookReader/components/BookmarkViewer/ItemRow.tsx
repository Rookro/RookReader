import { Box, ListItem, ListItemButton, ListItemText, MenuItem } from "@mui/material";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ContextMenu from "../../../../components/ui/ContextMenu/ContextMenu";
import { useContextMenuAnchor } from "../../../../components/ui/ContextMenu/useContextMenuAnchor";
import type { Bookmark } from "../../../../domain/entities";
import { preventRightClickFocus } from "../../../../utils/preventRightClickFocus";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";

/**
 * Row component for the bookmark viewer.
 *
 * @param bookmark - The bookmark to display.
 * @param id - Optional id, which the listbox's `aria-activedescendant` points at.
 * @param keyboardActive - Whether the row is drawn as the keyboard's active row.
 * @param onJump - Callback invoked to navigate to the bookmark.
 * @param onRename - Callback invoked to start renaming the bookmark.
 * @param onRemove - Callback invoked to delete the bookmark.
 */
export const ItemRow = memo(function ItemRow({
  bookmark,
  id,
  keyboardActive,
  onJump,
  onRename,
  onRemove,
}: {
  bookmark: Bookmark;
  id?: string;
  keyboardActive?: boolean;
  onJump: (bookmark: Bookmark) => void;
  onRename: (bookmark: Bookmark) => void;
  onRemove: (bookmark: Bookmark) => void;
}) {
  const { t } = useTranslation();
  const {
    anchor: contextMenu,
    open: handleContextMenu,
    close: handleMenuClosed,
  } = useContextMenuAnchor();

  const handleJumpClicked = useCallback(() => {
    handleMenuClosed();
    onJump(bookmark);
  }, [onJump, bookmark, handleMenuClosed]);

  const handleRenameClicked = useCallback(() => {
    handleMenuClosed();
    onRename(bookmark);
  }, [onRename, bookmark, handleMenuClosed]);

  const handleRemoveClicked = useCallback(() => {
    handleMenuClosed();
    onRemove(bookmark);
  }, [onRemove, bookmark, handleMenuClosed]);

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
            handleJumpClicked();
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
