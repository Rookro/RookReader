import LocalOffer from "@mui/icons-material/LocalOffer";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getBookTags } from "../../../../bindings/BookCommands";
import type { Tag } from "../../../../domain/tag/schema";
import { useAppDispatch } from "../../../../store/store";
import { useBookCheckStates } from "../../hooks/useBookCheckStates";
import { updateBooksTags } from "../../tagSlice";

/** Props for the SetBookTagsDialog component */
export interface SetBookTagsDialogProps {
  /** Whether the dialog is open or closed. */
  open: boolean;
  /** The IDs of the books for which tags are being set. */
  bookIds: number[];
  /** The available tags to choose from. */
  availableTags: Tag[];
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for setting book tags */
export default function SetBookTagsDialog({
  open,
  bookIds,
  availableTags,
  onClose,
}: SetBookTagsDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { stateOf, toggle, changes } = useBookCheckStates({
    open,
    bookIds,
    ids: availableTags.map((tag) => tag.id),
    load: getBookTags,
    loadErrorMessage: "Failed to fetch book tags",
  });

  const handleSave = useCallback(async () => {
    if (bookIds.length === 0 || changes === null) return;
    if (changes.length === 0) {
      onClose();
      return;
    }
    const result = await dispatch(
      updateBooksTags(changes.map(({ bookId, ids }) => ({ bookId, tagIds: ids }))),
    );
    // On failure the slice error is shown by GlobalErrorListener and the backend's
    // `books-changed` refetch reflects any partial success; stay open for retry.
    if (updateBooksTags.fulfilled.match(result)) {
      onClose();
    }
  }, [bookIds, changes, dispatch, onClose]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{t("bookshelf.tag.set.title")}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            maxHeight: 300,
            overflowY: "auto",
            overflowX: "hidden",
            paddingX: 2,
          }}
        >
          <List disablePadding>
            {availableTags.map((tag) => {
              return (
                <ListItem key={tag.id} disablePadding>
                  <ListItemIcon sx={{ minWidth: "auto", marginRight: "12px" }}>
                    <LocalOffer sx={{ color: tag.color_code }} />
                  </ListItemIcon>
                  <ListItemText id={`checkbox-tag-list-label-${tag.id}`} primary={tag.name} />
                  <Checkbox
                    edge="end"
                    onChange={() => toggle(tag.id)}
                    checked={stateOf(tag.id) === "checked"}
                    indeterminate={stateOf(tag.id) === "mixed"}
                  />
                </ListItem>
              );
            })}
            {availableTags.length === 0 && (
              <ListItem>
                <ListItemText primary={t("bookshelf.tag.set.no-tags-available")} />
              </ListItem>
            )}
          </List>
        </Box>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.tag.set.cancel-button")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={bookIds.length > 0 && changes === null}
        >
          {t("bookshelf.tag.set.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
