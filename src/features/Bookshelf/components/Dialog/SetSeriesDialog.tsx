import Add from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  OutlinedInput,
  Radio,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Series } from "../../../../domain/series/schema";
import { useAppDispatch } from "../../../../store/store";
import { addSeries, updateBooksSeries } from "../../seriesSlice";

/** Props for the SetSeriesDialog component */
export interface SetSeriesDialogProps {
  /** Whether the dialog is open or closed. */
  openDialog: boolean;
  /** The IDs of the books to update. */
  bookIds: number[];
  /** The available series to choose from. */
  availableSeries: Series[];
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog for setting a series for one or more books */
export default function SetSeriesDialog({
  openDialog,
  bookIds,
  availableSeries,
  onClose,
}: SetSeriesDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (openDialog) {
      setSelectedSeriesId(null);
      setSearchText("");
      setIsCreating(false);
      setNewSeriesName("");
    }
  }, [openDialog]);

  const filteredSeries = useMemo(() => {
    if (!searchText) return availableSeries;
    const lowerSearch = searchText.toLowerCase();
    return availableSeries.filter((s) => s.name.toLowerCase().includes(lowerSearch));
  }, [availableSeries, searchText]);

  const handleToggle = useCallback((seriesId: number | null) => {
    setSelectedSeriesId(seriesId);
  }, []);

  const handleSave = useCallback(async () => {
    if (bookIds.length === 0) {
      onClose();
      return;
    }
    const result = await dispatch(updateBooksSeries({ bookIds, seriesId: selectedSeriesId }));
    // On failure the slice error is shown by GlobalErrorListener and the backend's
    // `history-changed` refetch reflects any partial success; stay open for retry.
    if (updateBooksSeries.fulfilled.match(result)) {
      onClose();
    }
  }, [bookIds, selectedSeriesId, dispatch, onClose]);

  const handleCreateSeries = useCallback(async () => {
    if (!newSeriesName.trim()) return;
    const result = await dispatch(addSeries(newSeriesName.trim()));
    if (addSeries.fulfilled.match(result)) {
      setSelectedSeriesId(result.payload);
      setNewSeriesName("");
      setIsCreating(false);
    }
  }, [newSeriesName, dispatch]);

  return (
    <Dialog open={openDialog} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("bookshelf.series.set.title")}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <OutlinedInput
            placeholder={t("bookshelf.series.set.search-placeholder")}
            fullWidth
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Box>

        <Box
          sx={{
            maxHeight: 300,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <List disablePadding>
            <ListItem component="div" onClick={() => handleToggle(null)} sx={{ cursor: "pointer" }}>
              <ListItemIcon sx={{ minWidth: "auto", marginRight: "12px" }}>
                <Radio
                  edge="start"
                  checked={selectedSeriesId === null}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={t("bookshelf.series.set.none")} />
            </ListItem>
            <Divider />
            {filteredSeries.map((series) => (
              <ListItem
                key={series.id}
                component="div"
                onClick={() => handleToggle(series.id)}
                sx={{ cursor: "pointer" }}
              >
                <ListItemIcon sx={{ minWidth: "auto", marginRight: "12px" }}>
                  <Radio
                    edge="start"
                    checked={selectedSeriesId === series.id}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={series.name} />
              </ListItem>
            ))}
            {filteredSeries.length === 0 && searchText && (
              <ListItem>
                <ListItemText
                  secondary={t("bookshelf.series.set.no-search-results", { searchText })}
                />
              </ListItem>
            )}
          </List>
        </Box>

        <Box sx={{ mt: 2 }}>
          {isCreating ? (
            <Box sx={{ display: "flex", gap: 1 }}>
              <OutlinedInput
                fullWidth
                size="small"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder={t("bookshelf.series.creation.name-placeholder")}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSeries();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
              <Button
                variant="contained"
                onClick={handleCreateSeries}
                disabled={!newSeriesName.trim()}
              >
                {t("bookshelf.series.creation.creation-button")}
              </Button>
            </Box>
          ) : (
            <Button
              startIcon={<Add />}
              fullWidth
              onClick={() => setIsCreating(true)}
              sx={{ justifyContent: "flex-start", color: "text.secondary" }}
            >
              {t("bookshelf.series.creation.create-new")}
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.collection.cancel-button")}
        </Button>
        <Button variant="contained" onClick={handleSave}>
          {t("bookshelf.collection.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
