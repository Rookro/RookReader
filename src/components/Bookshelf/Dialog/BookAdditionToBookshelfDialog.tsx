import { useState, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
} from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { error } from "@tauri-apps/plugin-log";
import { useDragDropEvent } from "../../../hooks/useDragDropEvent";
import { useTranslation } from "react-i18next";
import { DeleteOutline, InsertDriveFileOutlined } from "@mui/icons-material";

/** Props for the BookAdditionToBookshelfDialog component */
export interface BookAdditionToBookshelfProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** Callback to add books to the bookshelf. */
  onAddBooks: (paths: string[]) => void;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for adding books to a bookshelf */
export default function BookAdditionToBookshelfDialog({
  openDialog,
  onAddBooks,
  onClose,
}: BookAdditionToBookshelfProps) {
  const { t } = useTranslation();
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleOpenDialog = useCallback(async () => {
    try {
      const selected = await open({
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
    if (openDialog) {
      setIsDragActive(true);
    }
  }, [openDialog]);

  const handleDropped = useCallback(
    (paths: string[]) => {
      if (openDialog) {
        setIsDragActive(false);
        if (paths && paths.length > 0) {
          setFilePaths((prev) => [...new Set([...prev, ...paths])]);
        }
      }
    },
    [openDialog],
  );

  const handleLeft = useCallback(() => {
    if (openDialog) {
      setIsDragActive(false);
    }
  }, [openDialog]);

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
    <Dialog open={openDialog} onClose={handleClose} fullWidth>
      <DialogTitle>{t("bookshelf.book-addition.title")}</DialogTitle>

      <DialogContent>
        <Paper
          variant="outlined"
          sx={{
            padding: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: isDragActive ? "primary.main" : "grey.400",
            backgroundColor: isDragActive ? "action.hover" : "background.paper",
          }}
        >
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {t("bookshelf.book-addition.drag-drop")}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {t("bookshelf.book-addition.or")}
          </Typography>
          <Button variant="contained" onClick={handleOpenDialog} disableElevation>
            {t("bookshelf.book-addition.select-file")}
          </Button>
        </Paper>

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
                        <DeleteOutline fontSize="small" />
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
