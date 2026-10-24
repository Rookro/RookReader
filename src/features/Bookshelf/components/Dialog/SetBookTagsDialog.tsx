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
import { error as logError } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBookTags } from "../../../../bindings/BookCommands";
import type { Tag } from "../../../../domain/tag/schema";
import { useAppDispatch } from "../../../../store/store";
import { updateBooksTags } from "../../tagSlice";
import {
  applyTagStates,
  initialTagStates,
  nextTagState,
  type TagCheckState,
} from "../../utils/tagSelection";

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
  // Each book's tags as loaded, or null while loading or after a failed read: saving
  // without them would overwrite tags the dialog never saw.
  const [bookTags, setBookTags] = useState<Map<number, number[]> | null>(null);
  const [initialStates, setInitialStates] = useState<Map<number, TagCheckState>>(new Map());
  const [states, setStates] = useState<Map<number, TagCheckState>>(new Map());

  // The tag list only seeds the states; a tag created while the dialog is open starts
  // unchecked rather than reloading every book's tags.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the books change.
  useEffect(() => {
    if (!open) {
      return;
    }
    setBookTags(null);
    setInitialStates(new Map());
    setStates(new Map());
    if (bookIds.length === 0) {
      return;
    }
    let stale = false;
    Promise.all(bookIds.map((bookId) => getBookTags(bookId)))
      .then((tagIdsPerBook) => {
        if (stale) return;
        const initial = initialTagStates(
          tagIdsPerBook,
          availableTags.map((tag) => tag.id),
        );
        setBookTags(new Map(bookIds.map((bookId, i) => [bookId, tagIdsPerBook[i]])));
        setInitialStates(initial);
        setStates(initial);
      })
      .catch((e) => {
        logError(`Failed to fetch book tags: ${e}`);
      });
    return () => {
      // Ignore a late response after the dialog reopened for other books.
      stale = true;
    };
  }, [open, bookIds]);

  const stateOf = useCallback((tagId: number) => states.get(tagId) ?? "unchecked", [states]);

  const handleToggle = useCallback(
    (tagId: number) => {
      setStates((current) =>
        new Map(current).set(
          tagId,
          nextTagState(current.get(tagId) ?? "unchecked", initialStates.get(tagId) ?? "unchecked"),
        ),
      );
    },
    [initialStates],
  );

  const handleSave = useCallback(async () => {
    if (bookIds.length === 0 || bookTags === null) return;
    const updates = applyTagStates(bookTags, states);
    if (updates.length === 0) {
      onClose();
      return;
    }
    const result = await dispatch(updateBooksTags(updates));
    // On failure the slice error is shown by GlobalErrorListener and the backend's
    // `books-changed` refetch reflects any partial success; stay open for retry.
    if (updateBooksTags.fulfilled.match(result)) {
      onClose();
    }
  }, [bookIds, bookTags, states, dispatch, onClose]);

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
                    onChange={() => handleToggle(tag.id)}
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
          disabled={bookIds.length > 0 && bookTags === null}
        >
          {t("bookshelf.tag.set.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
