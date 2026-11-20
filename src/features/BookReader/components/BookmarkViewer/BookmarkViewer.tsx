import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useContextMenuRegistry } from "../../../../components/ui/ContextMenu/useContextMenuRegistry";
import type { Bookmark } from "../../../../domain/entities";
import { useAfterCommit } from "../../../../hooks/useAfterCommit";
import {
  type ListKeyboardNavigation,
  useListKeyboardNavigation,
} from "../../../../hooks/useListKeyboardNavigation";
import { usePointerFocusRelease } from "../../../../hooks/usePointerFocusRelease";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import SidePanelHeader from "../../../SidePane/components/SidePanelHeader";
import {
  type PanelFocusRequest,
  useRegisterSidePanel,
  useSidePaneFocus,
} from "../../../SidePane/SidePaneFocusContext";
import { removeBookmark, updateBookmarkName } from "../../bookmarkSlice";
import { isComposing } from "../../input/guards";
import { setImageIndex, setNovelLocation } from "../../slice";
import { ItemRow } from "./ItemRow";

/**
 * Side panel listing the bookmarks of the book currently open in the reader.
 */
export default function BookmarkViewer() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isNovel = useAppSelector((state) => state.reader.isNovel);
  const bookmarks = useAppSelector((state) => state.bookmark.bookmarks);
  const [renameTarget, setRenameTarget] = useState<{
    bookmark: Bookmark;
    byKeyboard: boolean;
  } | null>(null);
  const [renameText, setRenameText] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const panelPointer = usePointerFocusRelease();
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const { isKeyboardInPane, returnToReader, requestPanelFocus } = useSidePaneFocus();
  const { register: registerMenu, open: openMenu } = useContextMenuRegistry<number>();
  const afterCommit = useAfterCommit();

  const handleJump = useCallback(
    (bookmark: Bookmark) => {
      // A novel bookmark carries a CFI pinning the exact position; a comic bookmark
      // only has a page index.
      if (isNovel && bookmark.cfi) {
        dispatch(setNovelLocation({ index: bookmark.pageIndex, cfi: bookmark.cfi }));
      } else {
        dispatch(setImageIndex(bookmark.pageIndex));
      }
    },
    [dispatch, isNovel],
  );

  const rowKeys = useMemo(() => bookmarks.map((b) => b.id), [bookmarks]);
  const nav: ListKeyboardNavigation<number> = useListKeyboardNavigation({
    rowKeys,
    currentKey: bookmarks[0]?.id ?? null,
    label: t("book-reader.bookmark-viewer.title"),
    scrollToIndex: (index) => {
      document.getElementById(nav.rowId(index))?.scrollIntoView({ block: "nearest" });
    },
    pageSize: () => {
      const rowHeight = document.getElementById(nav.rowId(0))?.offsetHeight || 1;
      return Math.max(1, Math.floor((scrollBoxRef.current?.clientHeight ?? 0) / rowHeight));
    },
    onOpen: (_key, index) => {
      returnToReader();
      handleJump(bookmarks[index]);
    },
    onOpenMenu: openMenu,
    onBecameEmpty: () => panelRef.current?.focus(),
    isKeyboardInUse: isKeyboardInPane,
  });

  useRegisterSidePanel((request: PanelFocusRequest) => {
    if (!nav.focusList(request)) {
      panelRef.current?.focus();
    }
  }, true);

  const { setActiveKey } = nav;
  const handleRowJump = useCallback(
    (bookmark: Bookmark) => {
      setActiveKey(bookmark.id);
      handleJump(bookmark);
    },
    [handleJump, setActiveKey],
  );

  const handleRename = useCallback((bookmark: Bookmark, byKeyboard: boolean) => {
    setRenameTarget({ bookmark, byKeyboard });
    setRenameText(bookmark.name);
  }, []);

  const handleRemove = useCallback(
    (bookmark: Bookmark) => {
      dispatch(removeBookmark(bookmark.id));
    },
    [dispatch],
  );

  // Back on the renamed row when the dialog was opened and closed from the keyboard.
  const closeRenameDialog = useCallback(
    (byKeyboard: boolean) => {
      if (renameTarget?.byKeyboard && byKeyboard) {
        const rowKey = renameTarget.bookmark.id;
        afterCommit(() => requestPanelFocus({ rowKey }));
      }
      setRenameTarget(null);
    },
    [renameTarget, afterCommit, requestPanelFocus],
  );

  const handleRenameDialogClosed = useCallback(
    (_e: unknown, reason: "backdropClick" | "escapeKeyDown") => {
      closeRenameDialog(reason === "escapeKeyDown");
    },
    [closeRenameDialog],
  );

  const handleRenameCancelled = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      closeRenameDialog(e.detail === 0);
    },
    [closeRenameDialog],
  );

  const handleRenameTextChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRenameText(e.target.value);
  }, []);

  const confirmRename = useCallback(
    (byKeyboard: boolean) => {
      if (renameTarget) {
        dispatch(updateBookmarkName({ id: renameTarget.bookmark.id, name: renameText }));
      }
      closeRenameDialog(byKeyboard);
    },
    [dispatch, renameTarget, renameText, closeRenameDialog],
  );

  const handleRenameConfirmed = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      confirmRename(e.detail === 0);
    },
    [confirmRename],
  );

  // Enter confirms as OK does, and only when OK is enabled.
  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" || isComposing(e.nativeEvent) || renameText.trim().length === 0) {
        return;
      }
      e.preventDefault();
      confirmRename(true);
    },
    [confirmRename, renameText],
  );

  return (
    <Stack
      ref={panelRef}
      tabIndex={-1}
      onPointerDown={panelPointer.onPointerDown}
      onFocus={panelPointer.onFocus}
      sx={{ width: "100%", height: "100%" }}
    >
      <SidePanelHeader title={t("book-reader.bookmark-viewer.title")} />
      {bookmarks.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {t("book-reader.bookmark-viewer.no-bookmarks")}
          </Typography>
        </Box>
      ) : (
        <Box ref={scrollBoxRef} sx={{ flexGrow: 1, overflow: "auto" }}>
          <List dense disablePadding {...nav.listProps}>
            {bookmarks.map((bookmark, index) => (
              <ItemRow
                key={bookmark.id}
                bookmark={bookmark}
                id={nav.rowId(index)}
                keyboardActive={nav.isKeyboardActive(index)}
                onJump={handleRowJump}
                onRename={handleRename}
                onRemove={handleRemove}
                registerMenu={registerMenu}
              />
            ))}
          </List>
        </Box>
      )}
      <Dialog
        open={renameTarget !== null}
        onClose={handleRenameDialogClosed}
        disableRestoreFocus={renameTarget?.byKeyboard === true}
        fullWidth
      >
        <DialogTitle>{t("book-reader.bookmark-viewer.rename-dialog.title")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            variant="standard"
            margin="dense"
            label={t("book-reader.bookmark-viewer.rename-dialog.name-label")}
            value={renameText}
            onChange={handleRenameTextChanged}
            onKeyDown={handleRenameKeyDown}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameCancelled}>
            {t("book-reader.bookmark-viewer.rename-dialog.cancel")}
          </Button>
          <Button onClick={handleRenameConfirmed} disabled={renameText.trim().length === 0}>
            {t("book-reader.bookmark-viewer.rename-dialog.ok")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
