import { Add, ArrowDownward, ArrowUpward, Home, Search, Settings } from "@mui/icons-material";
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
  Typography,
} from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import type { SortOrder } from "../../../types/AppSettings";
import { openSettingsWindow } from "../../../utils/WindowOpener";
import { updateSettings } from "../../Settings/slice";
import { addBookToBookshelf, setSearchText, setSelectedSeriesId } from "../slice";
import BookAdditionToBookshelfDialog from "./Dialog/BookAdditionToBookshelfDialog";

/** Navigation bar for the bookshelf component */
export default function NavigationBar() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const bookshelfSettings = useAppSelector((state) => state.settings.bookshelf);
  const bookshelfId = useAppSelector((state) => state.bookCollection.bookshelf.selectedId);
  const { selectedId: selectedSeriesId, series } = useAppSelector(
    (state) => state.bookCollection.series,
  );

  const selectedSeries = useMemo(() => {
    return series.find((s) => s.id === selectedSeriesId);
  }, [series, selectedSeriesId]);

  const [isAddBookDialogOpen, setIsAddBookDialogOpen] = useState(false);

  const handleSettingsClicked = useCallback(async (_e: React.MouseEvent<HTMLButtonElement>) => {
    debug("Settings button clicked in bookshelf.");
    openSettingsWindow();
  }, []);

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
      const newBookshelfSettings = { ...bookshelfSettings, sortOrder: e.target.value as SortOrder };
      dispatch(updateSettings({ key: "bookshelf", value: newBookshelfSettings }));
    },
    [dispatch, bookshelfSettings],
  );

  const handleAddClicked = useCallback((_e: React.MouseEvent) => {
    setIsAddBookDialogOpen(true);
  }, []);

  const handleAddBooks = useCallback(
    (paths: string[]) => {
      paths.forEach((bookPath) => {
        dispatch(addBookToBookshelf({ bookshelfId, bookPath }));
      });
    },
    [dispatch, bookshelfId],
  );

  return (
    <Stack>
      <Toolbar variant="dense" disableGutters sx={{ minHeight: "40px" }}>
        {selectedSeriesId !== null && (
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              marginLeft: "16px",
              "& .MuiBreadcrumbs-ol": {
                flexWrap: "nowrap",
              },
            }}
          >
            <Link
              underline="hover"
              sx={{ display: "flex", alignItems: "center", cursor: "pointer", color: "inherit" }}
              onClick={handleBackToBookshelf}
            >
              <Home sx={{ mr: 0.5 }} fontSize="inherit" />
              {t("bookshelf.title")}
            </Link>
            <Typography
              color="text.primary"
              sx={{
                display: "flex",
                alignItems: "center",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedSeries?.name ?? "..."}
            </Typography>
          </Breadcrumbs>
        )}
        <OutlinedInput
          type="search"
          size="small"
          placeholder={t("bookshelf.search-placeholder")}
          fullWidth
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
        />
        <IconButton onClick={handleSettingsClicked} aria-label="settings">
          <Settings />
        </IconButton>
      </Toolbar>
      <Toolbar variant="dense" disableGutters sx={{ paddingBottom: 1, justifyContent: "flex-end" }}>
        <Typography variant="body2" sx={{ alignContent: "center" }}>
          {t("bookshelf.sort.title")}
        </Typography>
        <Select
          size="small"
          autoWidth
          sx={{ marginX: 1 }}
          defaultValue={bookshelfSettings.sortOrder}
          onChange={handleSortOrderChanged}
        >
          <MenuItem value="name_asc">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowUpward fontSize="small" />
              <Typography variant="body2">{t("bookshelf.sort.name-asc")}</Typography>
            </Box>
          </MenuItem>
          <MenuItem value="name_desc">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowDownward fontSize="small" />
              <Typography variant="body2">{t("bookshelf.sort.name-desc")}</Typography>
            </Box>
          </MenuItem>
          <MenuItem value="date_asc">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowUpward fontSize="small" color="action" />
              <Typography variant="body2">{t("bookshelf.sort.date-asc")}</Typography>
            </Box>
          </MenuItem>
          <MenuItem value="date_desc">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowDownward fontSize="small" color="action" />
              <Typography variant="body2">{t("bookshelf.sort.date-desc")}</Typography>
            </Box>
          </MenuItem>
        </Select>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ borderRadius: 50 }}
          onClick={handleAddClicked}
        >
          {t("bookshelf.add-books")}
        </Button>
      </Toolbar>
      <BookAdditionToBookshelfDialog
        openDialog={isAddBookDialogOpen}
        onClose={() => setIsAddBookDialogOpen(false)}
        onAddBooks={handleAddBooks}
      />
    </Stack>
  );
}
