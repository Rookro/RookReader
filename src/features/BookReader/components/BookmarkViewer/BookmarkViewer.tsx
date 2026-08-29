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
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Bookmark } from "../../../../domain/bookmark/schema";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import SidePanelHeader from "../../../SidePane/components/SidePanelHeader";
import { fetchBookmarks, removeBookmark, updateBookmarkName } from "../../bookmarkSlice";
import { setImageIndex, setNovelLocation } from "../../slice";
import { ItemRow } from "./ItemRow";

/**
 * Side panel listing the bookmarks of the book currently open in the reader.
 */
export default function BookmarkViewer() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const bookId = useAppSelector((state) => state.read.containerFile.book?.id);
  const isNovel = useAppSelector((state) => state.read.containerFile.isNovel);
  const bookmarks = useAppSelector((state) => state.bookmark.bookmarks);
  const [renameTarget, setRenameTarget] = useState<Bookmark | null>(null);
  const [renameText, setRenameText] = useState("");

  useEffect(() => {
    if (bookId !== undefined) {
      dispatch(fetchBookmarks(bookId));
    }
  }, [dispatch, bookId]);

  const handleJump = useCallback(
    (bookmark: Bookmark) => {
      // A novel bookmark carries a CFI pinning the exact position; a comic bookmark
      // only has a page index.
      if (isNovel && bookmark.cfi) {
        dispatch(setNovelLocation({ index: bookmark.page_index, cfi: bookmark.cfi }));
      } else {
        dispatch(setImageIndex(bookmark.page_index));
      }
    },
    [dispatch, isNovel],
  );

  const handleRename = useCallback((bookmark: Bookmark) => {
    setRenameTarget(bookmark);
    setRenameText(bookmark.name);
  }, []);

  const handleRemove = useCallback(
    (bookmark: Bookmark) => {
      dispatch(removeBookmark(bookmark.id));
    },
    [dispatch],
  );

  const handleRenameDialogClosed = useCallback(() => {
    setRenameTarget(null);
  }, []);

  const handleRenameTextChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRenameText(e.target.value);
  }, []);

  const handleRenameConfirmed = useCallback(() => {
    if (renameTarget) {
      dispatch(updateBookmarkName({ id: renameTarget.id, name: renameText }));
    }
    setRenameTarget(null);
  }, [dispatch, renameTarget, renameText]);

  return (
    <Stack sx={{ width: "100%", height: "100%" }}>
      <SidePanelHeader title={t("book-reader.bookmark-viewer.title")} />
      {bookmarks.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {t("book-reader.bookmark-viewer.no-bookmarks")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          <List dense disablePadding>
            {bookmarks.map((bookmark) => (
              <ItemRow
                key={bookmark.id}
                bookmark={bookmark}
                onJump={handleJump}
                onRename={handleRename}
                onRemove={handleRemove}
              />
            ))}
          </List>
        </Box>
      )}
      <Dialog open={renameTarget !== null} onClose={handleRenameDialogClosed} fullWidth>
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameDialogClosed}>
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
