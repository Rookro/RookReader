import { Close, CollectionsBookmark, Delete, LibraryBooks, LocalOffer } from "@mui/icons-material";
import { Box, Button, Divider, IconButton, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

interface FloatingActionBarProps {
  /** Number of selected items */
  selectionCount: number;
  /** Callback to clear selection */
  onClear: () => void;
  /** Callback to open add to bookshelf dialog */
  onAddToBookshelf: () => void;
  /** Callback to open series dialog */
  onSetSeries: () => void;
  /** Callback to open tags dialog */
  onSetTags: () => void;
  /** Callback to open delete dialog */
  onDelete: () => void;
}

/**
 * A floating action bar that appears when items are selected.
 */
export default function FloatingActionBar({
  selectionCount,
  onClear,
  onAddToBookshelf,
  onSetTags,
  onSetSeries,
  onDelete,
}: FloatingActionBarProps) {
  const { t } = useTranslation();

  if (selectionCount === 0) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 16,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        paddingX: 2,
        zIndex: 10,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          paddingX: 2,
          paddingY: 1,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        <Typography variant="body2" fontWeight="bold">
          {t("bookshelf.selection.count", { count: selectionCount })}
        </Typography>
        <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.contrastText" }} />
        <Button
          size="small"
          color="inherit"
          startIcon={<LibraryBooks />}
          onClick={onAddToBookshelf}
        >
          {t("bookshelf.collection.add-books-title")}
        </Button>
        <Button
          size="small"
          color="inherit"
          startIcon={<CollectionsBookmark />}
          onClick={onSetSeries}
        >
          {t("bookshelf.series.set-series")}
        </Button>
        <Button size="small" color="inherit" startIcon={<LocalOffer />} onClick={onSetTags}>
          {t("bookshelf.tag.set-tags")}
        </Button>
        <Button size="small" color="inherit" startIcon={<Delete />} onClick={onDelete}>
          {t("bookshelf.remove-book")}
        </Button>
        <IconButton
          size="small"
          color="inherit"
          onClick={onClear}
          title={t("bookshelf.selection.clear")}
        >
          <Close fontSize="small" />
        </IconButton>
      </Paper>
    </Box>
  );
}
