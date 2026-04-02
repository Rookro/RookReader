import { LocalOffer } from "@mui/icons-material";
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
import { getBookTags, updateBookTags } from "../../../../bindings/BookCommands";
import type { Tag } from "../../../../types/DatabaseModels";

/** Props for the SetBookTagsDialog component */
export interface SetBookTagsDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** The ID of the book for which tags are being set. */
  bookId: number | null;
  /** The available tags to choose from. */
  availableTags: Tag[];
  /** Callback to update the tags for the book. */
  onUpdateTags: () => void;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for setting book tags */
export default function SetBookTagsDialog({
  openDialog,
  bookId,
  availableTags,
  onUpdateTags,
  onClose,
}: SetBookTagsDialogProps) {
  const { t } = useTranslation();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (openDialog && bookId !== null) {
      getBookTags(bookId)
        .then((tagIds) => {
          setSelectedTagIds(new Set(tagIds));
        })
        .catch((e) => {
          logError(`Failed to fetch book tags: ${e}`);
        });
    }
  }, [openDialog, bookId]);

  const handleToggle = useCallback(
    (tagId: number) => {
      const newSelected = new Set(selectedTagIds);
      if (newSelected.has(tagId)) {
        newSelected.delete(tagId);
      } else {
        newSelected.add(tagId);
      }
      setSelectedTagIds(newSelected);
    },
    [selectedTagIds],
  );

  const handleSave = useCallback(async () => {
    if (bookId === null) return;
    try {
      await updateBookTags(bookId, Array.from(selectedTagIds));
      onUpdateTags();
      onClose();
    } catch (e) {
      logError(`Failed to update book tags: ${e}`);
    }
  }, [bookId, selectedTagIds, onUpdateTags, onClose]);

  return (
    <Dialog open={openDialog} onClose={onClose} fullWidth>
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
                    checked={selectedTagIds.has(tag.id)}
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
        <Button variant="contained" onClick={handleSave}>
          {t("bookshelf.tag.set.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
