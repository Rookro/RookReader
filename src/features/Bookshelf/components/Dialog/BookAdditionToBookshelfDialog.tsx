import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import LibraryAddOutlined from "@mui/icons-material/LibraryAddOutlined";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { dropTargetActiveSx } from "../../../../components/ui/DropOverlay";
import { useDragDropEvent } from "../../../../hooks/useDragDropEvent";

/** Props for the BookAdditionToBookshelfDialog component */
export interface BookAdditionToBookshelfProps {
  /** Whether the dialog is open or closed. */
  open: boolean;
  /** Callback to add books to the bookshelf. */
  onAddBooks: (paths: string[]) => void;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for adding books to a bookshelf */
export default function BookAdditionToBookshelfDialog({
  open,
  onAddBooks,
  onClose,
}: BookAdditionToBookshelfProps) {
  const { t } = useTranslation();
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleOpenDialog = useCallback(async () => {
    try {
      const selected = await openFilePicker({
        multiple: true,
        directory: false,
      });

      if (Array.isArray(selected)) {
        setFilePaths((prev) => [...new Set([...prev, ...selected])]);
      } else if (typeof selected === "string") {
        setFilePaths((prev) => [...new Set([...prev, selected])]);
      }
    } catch (e) {
      error(`Failed to open the file selection dialog: ${e}`);
    }
  }, []);

  const handleDragged = useCallback(() => {
    if (open) {
      setIsDragActive(true);
    }
  }, [open]);

  const handleDropped = useCallback(
    (paths: string[]) => {
      if (open) {
        setIsDragActive(false);
        if (paths && paths.length > 0) {
          setFilePaths((prev) => [...new Set([...prev, ...paths])]);
        }
      }
    },
    [open],
  );

  const handleLeft = useCallback(() => {
    if (open) {
      setIsDragActive(false);
    }
  }, [open]);

  useDragDropEvent({ onDrag: handleDragged, onDrop: handleDropped, onLeave: handleLeft });

  const handleClose = useCallback(() => {
    setFilePaths([]);
    setIsDragActive(false);
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(() => {
    onAddBooks(filePaths);
    handleClose();
  }, [filePaths, onAddBooks, handleClose]);

  const handleRemoveFile = useCallback((pathToRemove: string) => {
    setFilePaths((prev) => prev.filter((path) => path !== pathToRemove));
  }, []);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth>
      <DialogTitle>{t("bookshelf.book-addition.title")}</DialogTitle>

      <DialogContent>
        <Box
          sx={[
            (theme) => ({
              padding: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              textAlign: "center",
              // The outlined input's border colour.
              border: `2px dashed ${theme.palette.mode === "light" ? "rgba(0, 0, 0, 0.23)" : "rgba(255, 255, 255, 0.23)"}`,
              borderRadius: 2,
              backgroundColor: "transparent",
            }),
            isDragActive && dropTargetActiveSx,
          ]}
        >
          <LibraryAddOutlined
            sx={{ fontSize: 40, color: isDragActive ? "primary.main" : "text.secondary" }}
          />
          <Typography variant="body1">{t("bookshelf.book-addition.drag-drop")}</Typography>
          <Typography variant="body2" color="textSecondary">
            {t("bookshelf.book-addition.or")}
          </Typography>
          <Button
            variant="contained"
            onClick={handleOpenDialog}
            disableElevation
            sx={{ marginTop: 1 }}
          >
            {t("bookshelf.book-addition.select-file")}
          </Button>
        </Box>

        {filePaths.length > 0 && (
          <Box sx={{ marginTop: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              {t("bookshelf.book-addition.selected-files", { count: filePaths.length })}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                maxHeight: 160,
                overflowY: "auto",
                bgcolor: "background.default",
              }}
            >
              <List dense disablePadding>
                {filePaths.map((path) => (
                  <ListItem
                    key={path}
                    divider
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveFile(path)}
                        aria-label="delete"
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <InsertDriveFileOutlined fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={path.split(/[/\\]/).pop()}
                      secondary={path}
                      slotProps={{
                        primary: {
                          variant: "body2",
                          noWrap: true,
                          title: path.split(/[/\\]/).pop(),
                        },
                        secondary: {
                          variant: "caption",
                          noWrap: true,
                          title: path,
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={handleClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.book-addition.cancel-button")}
        </Button>
        <Button variant="contained" disabled={filePaths.length < 1} onClick={handleCreate}>
          {t("bookshelf.book-addition.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
