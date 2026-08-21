import { Box, ListItem, ListItemButton, ListItemText, Menu, MenuItem } from "@mui/material";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Bookmark } from "../../../../domain/bookmark/schema";

/**
 * Row component for the bookmark viewer.
 *
 * @param bookmark - The bookmark to display.
 * @param onJump - Callback invoked to navigate to the bookmark.
 * @param onRename - Callback invoked to start renaming the bookmark.
 * @param onRemove - Callback invoked to delete the bookmark.
 */
export const ItemRow = memo(function ItemRow({
  bookmark,
  onJump,
  onRename,
  onRemove,
}: {
  bookmark: Bookmark;
  onJump: (bookmark: Bookmark) => void;
  onRename: (bookmark: Bookmark) => void;
  onRemove: (bookmark: Bookmark) => void;
}) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY });
  }, []);

  const handleMenuClosed = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleJumpClicked = useCallback(() => {
    setContextMenu(null);
    onJump(bookmark);
  }, [onJump, bookmark]);

  const handleRenameClicked = useCallback(() => {
    setContextMenu(null);
    onRename(bookmark);
  }, [onRename, bookmark]);

  const handleRemoveClicked = useCallback(() => {
    setContextMenu(null);
    onRemove(bookmark);
  }, [onRemove, bookmark]);

  return (
    <Box component="div" onContextMenu={handleContextMenu}>
      <ListItem component="div" disablePadding dense>
        <ListItemButton onClick={handleJumpClicked} sx={{ padding: "4px 8px" }}>
          <ListItemText
            primary={bookmark.name}
            secondary={t("book-reader.bookmark-viewer.page-caption", {
              page: bookmark.page_index + 1,
            })}
            slotProps={{ primary: { noWrap: true }, secondary: { variant: "caption" } }}
          />
        </ListItemButton>
      </ListItem>
      <Menu
        open={contextMenu !== null}
        onClose={handleMenuClosed}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        slotProps={{ list: { dense: true } }}
      >
        <MenuItem onClick={handleJumpClicked}>
          {t("book-reader.bookmark-viewer.menu.jump")}
        </MenuItem>
        <MenuItem onClick={handleRenameClicked}>
          {t("book-reader.bookmark-viewer.menu.rename")}
        </MenuItem>
        <MenuItem onClick={handleRemoveClicked}>
          {t("book-reader.bookmark-viewer.menu.remove")}
        </MenuItem>
      </Menu>
    </Box>
  );
});
