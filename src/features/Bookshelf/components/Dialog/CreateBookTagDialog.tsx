import { Check, Close } from "@mui/icons-material";
import {
  Dialog,
  DialogTitle,
  IconButton,
  DialogContent,
  TextField,
  Typography,
  DialogActions,
  Button,
  Grid,
  Chip,
  Box,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

/** Props for the CreateTagDialog component */
export interface CreateTagDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** Callback to create a book tag. */
  onCreate: (name: string, color_code: string) => void;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for creating a book tag */
export default function CreateTagDialog({ openDialog, onCreate, onClose }: CreateTagDialogProps) {
  const { t } = useTranslation();
  const [tagName, setTagName] = useState("");
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const handleCreate = useCallback(() => {
    onCreate(tagName, tagColors[selectedColorIndex]);
    setTagName("");
    setSelectedColorIndex(0);
    onClose();
  }, [onCreate, onClose, tagName, selectedColorIndex]);

  const handleClose = useCallback(() => {
    setTagName("");
    setSelectedColorIndex(0);
    onClose();
  }, [onClose]);

  const isCreateEnabled = tagName.trim().length > 0;

  return (
    <Dialog open={openDialog} onClose={handleClose}>
      <DialogTitle>{t("bookshelf.tag.creation.title")}</DialogTitle>
      <IconButton
        size="small"
        onClick={handleClose}
        sx={{ position: "absolute", right: 8, top: 8, color: "text.secondary" }}
      >
        <Close fontSize="small" />
      </IconButton>
      <DialogContent sx={{ paddingTop: 0 }}>
        <TextField
          type="text"
          variant="outlined"
          label={t("bookshelf.tag.creation.name-placeholder")}
          autoFocus
          fullWidth
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          sx={{ marginBottom: 3, marginTop: 1 }}
        />

        <Typography variant="subtitle2" sx={{ color: "text.secondary", marginBottom: 1 }}>
          {t("bookshelf.tag.creation.color-title")}
        </Typography>

        <Box
          sx={{
            maxHeight: 180,
            overflowY: "auto",
            overflowX: "hidden",
            marginBottom: 2,
            padding: 0.5,
          }}
        >
          <Grid container spacing={1}>
            {tagColors.map((color, index) => (
              <Grid key={index}>
                <ColorButton
                  color={color}
                  selected={selectedColorIndex === index}
                  onClick={() => setSelectedColorIndex(index)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Typography variant="subtitle2" sx={{ color: "text.secondary", marginBottom: 1 }}>
          {t("bookshelf.tag.creation.preview-title")}
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <TagPreview name={tagName} color={tagColors[selectedColorIndex]} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={handleClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.tag.creation.cancel-button")}
        </Button>
        <Button onClick={handleCreate} variant="contained" disabled={!isCreateEnabled}>
          {t("bookshelf.tag.creation.creation-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Colors available for book tags */
const tagColors = [
  "#F44336", // Red 500
  "#D32F2F", // Red 700 (Dark)
  "#E91E63", // Pink 500
  "#F06292", // Pink 300 (Light)

  "#9C27B0", // Purple 500
  "#7B1FA2", // Purple 700 (Dark)
  "#673AB7", // Deep Purple 500
  "#512DA8", // Deep Purple 700 (Dark)

  "#3F51B5", // Indigo 500
  "#303F9F", // Indigo 700 (Dark)
  "#2196F3", // Blue 500
  "#1976D2", // Blue 700 (Dark)
  "#03A9F4", // Light Blue 500
  "#4FC3F7", // Light Blue 300 (Light)

  "#00BCD4", // Cyan 500
  "#0097A7", // Cyan 700 (Dark)
  "#009688", // Teal 500
  "#4DB6AC", // Teal 300 (Light)

  "#4CAF50", // Green 500
  "#388E3C", // Green 700 (Dark)
  "#8BC34A", // Light Green 500
  "#CDDC39", // Lime 500

  "#FFEB3B", // Yellow 500
  "#FFC107", // Amber 500
  "#FFA000", // Amber 700 (Dark)
  "#FF9800", // Orange 500
  "#F57C00", // Orange 700 (Dark)
  "#FF5722", // Deep Orange 500

  "#795548", // Brown 500
  "#9E9E9E", // Grey 500
  "#607D8B", // Blue Grey 500
  "#455A64", // Blue Grey 700 (Dark)
  "#212121", // Grey 900 (Dark Grey / Black)
];

/** Props for the ColorButton component */
interface ColorButtonProps {
  color: string;
  selected: boolean;
  onClick: () => void;
}

/** Button for selecting a color for a book tag */
export function ColorButton({ color, selected, onClick }: ColorButtonProps) {
  return (
    <IconButton
      sx={{
        width: 48,
        height: 48,
        backgroundColor: color,
        "&:hover": {
          backgroundColor: color,
          opacity: 0.8,
        },
      }}
      onClick={onClick}
    >
      {selected && (
        <Check
          sx={{
            color: "#fff",
            fontSize: "1.5rem",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </IconButton>
  );
}

/** Props for the TagPreview component */
interface TagPreviewProps {
  name: string;
  color: string;
}

/** Preview of a book tag */
export function TagPreview({ name, color }: TagPreviewProps) {
  const { t } = useTranslation();
  return (
    <Chip
      label={name || t("bookshelf.tag.creation.preview-name")}
      sx={{
        backgroundColor: color,
        fontSize: "1rem",
      }}
    />
  );
}
