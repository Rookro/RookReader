import AccessTime from "@mui/icons-material/AccessTime";
import Add from "@mui/icons-material/Add";
import Home from "@mui/icons-material/Home";
import Search from "@mui/icons-material/Search";
import Settings from "@mui/icons-material/Settings";
import Sort from "@mui/icons-material/Sort";
import SortByAlpha from "@mui/icons-material/SortByAlpha";
import {
  Box,
  Breadcrumbs,
  Button,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DropOverlay from "../../../components/ui/DropOverlay";
import { useWindowDrop } from "../../../hooks/useWindowDrop";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import type { SortOrder } from "../../../types/AppSettings";
import { openSettingsWindow } from "../../../utils/WindowOpener";
import { updateSettings } from "../../Settings/slice";
import { useAddBooksToBookshelf } from "../hooks/useAddBooksToBookshelf";
import { setSelectedSeriesId } from "../seriesSlice";
import { setSearchText } from "../slice";
import { useBookshelfActions } from "./BookshelfActionsContext";
import BookAdditionToBookshelfDialog from "./Dialog/BookAdditionToBookshelfDialog";

/** Toolbar of the bookshelf: search, sort, add books, and the series breadcrumb */
export default function BookshelfToolbar() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const bookshelfSettings = useAppSelector((state) => state.settings.bookshelf);
  const searchText = useAppSelector((state) => state.collection.searchText);
  const { selectedId: selectedSeriesId, series } = useAppSelector((state) => state.series);
  const { openEditSeriesOrderDialog } = useBookshelfActions();

  const selectedSeries = useMemo(() => {
    return series.find((s) => s.id === selectedSeriesId);
  }, [series, selectedSeriesId]);

  const [isAddBookDialogOpen, setIsAddBookDialogOpen] = useState(false);

  const handleSettingsClicked = useCallback(
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
      debug("Settings button clicked in bookshelf.");
      await openSettingsWindow(t("common.settings"));
    },
    [t],
  );

  const handleBackToBookshelf = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dispatch(setSelectedSeriesId(null));
    },
    [dispatch],
  );

  const handleSearchTextChanged = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      dispatch(setSearchText(e.target.value));
    },
    [dispatch],
  );

  const handleSortOrderChanged = useCallback(
    (e: SelectChangeEvent) => {
      dispatch(
        updateSettings({ key: "bookshelf", value: { sortOrder: e.target.value as SortOrder } }),
      );
    },
    [dispatch],
  );

  const handleAddClicked = useCallback((_e: React.MouseEvent) => {
    setIsAddBookDialogOpen(true);
  }, []);

  const handleEditOrderClicked = useCallback(() => {
    if (selectedSeriesId !== null) {
      openEditSeriesOrderDialog(selectedSeriesId);
    }
  }, [openEditSeriesOrderDialog, selectedSeriesId]);

  const addBooks = useAddBooksToBookshelf();
  const handleAddBooks = useCallback(
    (paths: string[]) => {
      void addBooks(paths);
    },
    [addBooks],
  );

  const activeView = useAppSelector((state) => state.view.activeView);
  const collectionId = useAppSelector((state) => state.collection.selectedId);
  const collections = useAppSelector((state) => state.collection.collections);
  // While the Add books dialog is open, it takes the drop itself.
  const takesDrop = activeView === "bookshelf" && !isAddBookDialogOpen;
  const handleDropped = useCallback(
    (paths: string[]) => {
      if (takesDrop) {
        void addBooks(paths);
      }
    },
    [takesDrop, addBooks],
  );
  const isDragging = useWindowDrop(handleDropped);
  const dropTargetName =
    collections.find((collection) => collection.id === collectionId)?.name ??
    t("bookshelf.collection.all-books");

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <Stack>
      <Toolbar variant="dense" disableGutters sx={{ minHeight: "40px" }}>
        <OutlinedInput
          type="search"
          size="small"
          placeholder={t("bookshelf.search-placeholder")}
          fullWidth
          value={searchText}
          sx={{
            marginLeft: "16px",
            marginRight: "4px",
            paddingLeft: "4px",
            "& .MuiOutlinedInput-input": {
              padding: "4px 8px 4px 4px",
            },
            backgroundColor: "background.paper",
          }}
          startAdornment={
            <InputAdornment position="start" sx={{ marginRight: "0px" }}>
              <Search />
            </InputAdornment>
          }
          onChange={handleSearchTextChanged}
          onContextMenu={handleContextMenu}
        />
        <Tooltip title={t("common.settings")}>
          <IconButton onClick={handleSettingsClicked} aria-label="settings">
            <Settings />
          </IconButton>
        </Tooltip>
      </Toolbar>
      <Toolbar variant="dense" disableGutters sx={{ paddingBottom: 1, justifyContent: "flex-end" }}>
        {selectedSeriesId !== null && (
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              flex: 1,
              minWidth: 0,
              marginLeft: "16px",
              marginRight: 1,
              "& .MuiBreadcrumbs-ol": {
                flexWrap: "nowrap",
              },
              "& .MuiBreadcrumbs-li:last-of-type": {
                minWidth: 0,
              },
            }}
          >
            <Link
              underline="hover"
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                color: "inherit",
                whiteSpace: "nowrap",
              }}
              onClick={handleBackToBookshelf}
            >
              <Home sx={{ marginRight: "4px" }} fontSize="small" />
              {t("bookshelf.title")}
            </Link>
            <Typography color="text.primary" noWrap>
              {selectedSeries?.name ?? "..."}
            </Typography>
          </Breadcrumbs>
        )}
        {selectedSeriesId === null && (
          <>
            <Typography variant="body2" sx={{ alignContent: "center" }}>
              {t("bookshelf.sort.title")}
            </Typography>
            <Select
              size="small"
              autoWidth
              sx={{ marginX: 1 }}
              value={bookshelfSettings.sortOrder}
              onChange={handleSortOrderChanged}
            >
              <MenuItem value="name_asc">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <SortByAlpha fontSize="small" />
                  <Typography variant="body2">{t("bookshelf.sort.name-asc")}</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="name_desc">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <SortByAlpha fontSize="small" />
                  <Typography variant="body2">{t("bookshelf.sort.name-desc")}</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="date_asc">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTime fontSize="small" />
                  <Typography variant="body2">{t("bookshelf.sort.date-asc")}</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="date_desc">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTime fontSize="small" />
                  <Typography variant="body2">{t("bookshelf.sort.date-desc")}</Typography>
                </Box>
              </MenuItem>
            </Select>
          </>
        )}
        {selectedSeriesId !== null && (
          <Button
            variant="outlined"
            startIcon={<Sort />}
            sx={{ borderRadius: 50, marginRight: 1 }}
            onClick={handleEditOrderClicked}
          >
            {t("bookshelf.series.edit-order.title")}
          </Button>
        )}
        {selectedSeriesId === null && (
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{ borderRadius: 50, marginRight: 1 }}
            onClick={handleAddClicked}
          >
            {t("bookshelf.add-books")}
          </Button>
        )}
      </Toolbar>
      <BookAdditionToBookshelfDialog
        open={isAddBookDialogOpen}
        onClose={() => setIsAddBookDialogOpen(false)}
        onAddBooks={handleAddBooks}
      />
      <DropOverlay
        open={isDragging && takesDrop}
        message={
          selectedSeriesId !== null
            ? t("bookshelf.drop-to-add-to-series", { name: selectedSeries?.name ?? "" })
            : t("bookshelf.drop-to-add", { name: dropTargetName })
        }
      />
    </Stack>
  );
}
