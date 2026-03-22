import { Add, ArrowDownward, ArrowUpward, Search, Settings } from "@mui/icons-material";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { ChangeEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { openSettingsWindow } from "../../utils/WindowOpener";
import { SortOrder } from "../../types/SortOrderType";
import { addBookToBookshelf, setSearchText } from "../../reducers/BookCollectionReducer";
import { useAppDispatch, useAppSelector } from "../../Store";
import BookAdditionToBookshelfDialog from "./Dialog/BookAdditionToBookshelfDialog";
import { updateSettings } from "../../reducers/SettingsReducer";

/** Navigation bar for the bookshelf component */
export default function NavigationBar() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { "bookshelf-sort-order": sortOrder } = useAppSelector((state) => state.settings);
  const { selectedId: bookshelfId } = useAppSelector((state) => state.bookCollection.bookshelf);

  const [isAddBookDialogOpen, setIsAddBookDialogOpen] = useState(false);

  const handleSettingsClicked = useCallback(async (_e: React.MouseEvent<HTMLButtonElement>) => {
    debug("Settings button clicked in bookshelf.");
    openSettingsWindow();
  }, []);

  const handleSearchTextChanged = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      dispatch(setSearchText(e.target.value));
    },
    [dispatch],
  );

  const handleSortOrderChanged = useCallback(
    (e: SelectChangeEvent) => {
      dispatch(updateSettings({ key: "bookshelf-sort-order", value: e.target.value as SortOrder }));
    },
    [dispatch],
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
          defaultValue={sortOrder}
          onChange={handleSortOrderChanged}
        >
          <MenuItem value="NAME_ASC">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowUpward fontSize="small" />
              <Typography variant="body2">{t("bookshelf.sort.name-asc")}</Typography>
            </Box>
          </MenuItem>
          <MenuItem value="NAME_DESC">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowDownward fontSize="small" />
              <Typography variant="body2">{t("bookshelf.sort.name-desc")}</Typography>
            </Box>
          </MenuItem>
          <MenuItem value="DATE_ASC">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ArrowUpward fontSize="small" color="action" />
              <Typography variant="body2">{t("bookshelf.sort.date-asc")}</Typography>
            </Box>
          </MenuItem>
          <MenuItem value="DATE_DESC">
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
