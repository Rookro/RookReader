import { Close } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookShelfIcons } from "../BookshelfIcons";

/** Props for the CreateBookshelfDialog component */
export interface CreateBookshelfDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** Callback to create a bookshelf. */
  onCreate: (name: string, icon_id: string) => void;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for creating a bookshelf */
export function CreateBookshelfDialog({
  openDialog,
  onCreate,
  onClose,
}: CreateBookshelfDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selectedIconIndex, setSelectedIconIndex] = useState(0);

  const handleCreate = useCallback(() => {
    onCreate(name, BookShelfIcons[selectedIconIndex].key);
    setName("");
    setSelectedIconIndex(0);
    onClose();
  }, [name, onCreate, onClose, selectedIconIndex]);

  const handleCancelClicked = useCallback(() => {
    setName("");
    setSelectedIconIndex(0);
    onClose();
  }, [onClose]);

  const isCreateEnabled = name.trim().length > 0;

  return (
    <Dialog open={openDialog} onClose={onClose}>
      <DialogTitle>{t("bookshelf.collection.creation.title")}</DialogTitle>
      <IconButton
        size="small"
        onClick={handleCancelClicked}
        sx={{ position: "absolute", right: 8, top: 8, color: "text.secondary" }}
      >
        <Close fontSize="small" />
      </IconButton>
      <DialogContent sx={{ paddingTop: 0 }}>
        <TextField
          type="text"
          variant="outlined"
          label={t("bookshelf.collection.creation.name-placeholder")}
          autoFocus
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ marginBottom: 3, marginTop: 1 }}
        />

        <Typography variant="subtitle2" sx={{ color: "text.secondary", marginBottom: 1 }}>
          {t("bookshelf.collection.creation.icon-selection-title")}
        </Typography>

        <Box
          sx={{
            maxHeight: 180,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 0.5,
          }}
        >
          <Grid container spacing={1}>
            {BookShelfIcons.map(({ key, icon }, index) => {
              const isSelected = selectedIconIndex === index;
              return (
                <Grid key={key}>
                  <IconButton
                    size="large"
                    onClick={() => setSelectedIconIndex(index)}
                    sx={{
                      border: "2px solid",
                      borderColor: isSelected ? "primary.main" : "divider",
                      color: isSelected ? "primary.contrastText" : "action.active",
                      backgroundColor: isSelected ? "primary.main" : "background.paper",
                      borderRadius: "12px",
                      "&:hover": {
                        backgroundColor: isSelected ? "primary.dark" : "action.hover",
                        borderColor: isSelected ? "primary.dark" : "text.primary",
                      },
                    }}
                  >
                    {icon}
                  </IconButton>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={handleCancelClicked} sx={{ color: "text.secondary" }}>
          {t("bookshelf.collection.creation.cancel-button")}
        </Button>
        <Button onClick={handleCreate} variant="contained" disabled={!isCreateEnabled}>
          {t("bookshelf.collection.creation.creation-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
