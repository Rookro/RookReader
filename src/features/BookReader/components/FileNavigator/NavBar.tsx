import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import Home from "@mui/icons-material/Home";
import Refresh from "@mui/icons-material/Refresh";
import Search from "@mui/icons-material/Search";
import {
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  Tooltip,
} from "@mui/material";
import { dirname, homeDir } from "@tauri-apps/api/path";
import { warn } from "@tauri-apps/plugin-log";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import type { SortOrder } from "../../../../types/AppSettings";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";
import { updateSettings } from "../../../Settings/slice";
import {
  goBackNavigatorHistory,
  goForwardNavigatorHistory,
  loadDirectory,
  setSearchText,
} from "../../fileNavigatorSlice";
import { isComposing } from "../../input/guards";

/** Props for {@link NavBar}. */
export interface NavBarProps {
  /** The search field's input, which the panel focuses while a search hides every entry. */
  searchInputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Navigation bar component for File navigator component.
 */
export default function NavBar({ searchInputRef }: NavBarProps) {
  const { t } = useTranslation();
  const history = useAppSelector((state) => state.fileNavigator.history);
  const historyIndex = useAppSelector((state) => state.fileNavigator.historyIndex);
  const searchText = useAppSelector((state) => state.fileNavigator.searchText);
  const entries = useAppSelector((state) => state.fileNavigator.entries);
  const fileNavigatorSettings = useAppSelector((state) => state.settings.fileNavigator);
  const dispatch = useAppDispatch();

  const currentPath = history[historyIndex] ?? "";

  const setDirParh = useCallback(
    async (dirPath: string | undefined = undefined) => {
      if (!dirPath) {
        dirPath = fileNavigatorSettings.homeDirectory || (await homeDir());
      }
      dispatch(setSearchText(""));
      dispatch(loadDirectory({ dirPath }));
    },
    [dispatch, fileNavigatorSettings.homeDirectory],
  );

  useEffect(() => {
    if (entries.length === 0) {
      const dirPath = historyIndex === -1 ? undefined : history[historyIndex];
      setDirParh(dirPath);
    }
  }, [entries.length, historyIndex, history, setDirParh]);

  const formAction = useCallback(
    (formData: FormData) => {
      const inputPath = formData.get("path")?.toString();

      if (inputPath && inputPath !== currentPath) {
        dispatch(setSearchText(""));
        dispatch(loadDirectory({ dirPath: inputPath }));
      }
    },
    [dispatch, currentPath],
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.form?.requestSubmit();
  }, []);

  // With no edit to revert, Esc is left to the side pane's keys, which return to the reader.
  const handlePathKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (
        e.key === "Escape" &&
        e.currentTarget.value !== currentPath &&
        !isComposing(e.nativeEvent)
      ) {
        e.preventDefault();
        e.currentTarget.value = currentPath;
      }
    },
    [currentPath],
  );

  const handleHomeClicked = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      releaseMouseFocus(e);
      setDirParh();
    },
    [setDirParh],
  );

  const handleParentClicked = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      releaseMouseFocus(e);
      try {
        const parentDir = await dirname(history[historyIndex]);
        dispatch(loadDirectory({ dirPath: parentDir }));
      } catch (e) {
        warn(`Failed to get parent directory of ${history[historyIndex]}. Error: ${e}.`);
      }
    },
    [dispatch, history, historyIndex],
  );

  const handleRefleshClicked = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      releaseMouseFocus(e);
      dispatch(loadDirectory({ dirPath: history[historyIndex], forceUpdate: true }));
    },
    [dispatch, history, historyIndex],
  );

  const handleSearchTextChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setSearchText(e.target.value));
    },
    [dispatch],
  );

  // With nothing to clear, Esc is left to the side pane's keys, which return to the reader.
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape" && searchText !== "" && !isComposing(e.nativeEvent)) {
        e.preventDefault();
        dispatch(setSearchText(""));
      }
    },
    [dispatch, searchText],
  );

  const handleBackClicked = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      releaseMouseFocus(e);
      dispatch(goBackNavigatorHistory());
    },
    [dispatch],
  );

  const handleForwardClicked = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      releaseMouseFocus(e);
      dispatch(goForwardNavigatorHistory());
    },
    [dispatch],
  );

  const handleSortOrderChanged = useCallback(
    (event: SelectChangeEvent) => {
      dispatch(
        updateSettings({
          key: "fileNavigator",
          value: { sortOrder: event.target.value as SortOrder },
        }),
      );
    },
    [dispatch],
  );

  // A mouse pick or a click outside the menu leaves focus on the select, which would keep the
  // reader's keys in the side pane; the menu restores that focus as it closes, so it is released
  // once the menu is gone.
  const sortSelectRef = useRef<HTMLDivElement>(null);
  const sortClosedByMouse = useRef(false);
  const handleSortClosed = useCallback((e: React.SyntheticEvent) => {
    sortClosedByMouse.current = "detail" in e && typeof e.detail === "number" && e.detail > 0;
  }, []);
  const handleSortMenuExited = useCallback(() => {
    const focused = document.activeElement;
    if (
      sortClosedByMouse.current &&
      focused instanceof HTMLElement &&
      sortSelectRef.current?.contains(focused)
    ) {
      focused.blur();
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <Stack>
      <Box component="form" action={formAction} sx={{ flexGrow: 1 }}>
        <OutlinedInput
          // Force DOM recreation to update the initial value on external state changes.
          key={currentPath}
          name="path"
          defaultValue={currentPath}
          onContextMenu={handleContextMenu}
          onKeyDown={handlePathKeyDown}
          onBlur={handleBlur}
          size="small"
          fullWidth
          sx={{
            "& .MuiOutlinedInput-input": {
              padding: "4px 8px",
            },
          }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          "& .MuiIconButton-root": {
            color: (theme) => theme.palette.primary.main,
          },
          "& .MuiIconButton-root.Mui-disabled": {
            color: (theme) => theme.palette.action.disabled,
          },
        }}
      >
        <Tooltip title={t("book-reader.file-navigator.home")}>
          <IconButton onClick={handleHomeClicked} aria-label="home">
            <Home />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("common.back")}>
          <span>
            <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0} aria-label="back">
              <ArrowBack />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("common.forward")}>
          <span>
            <IconButton
              onClick={handleForwardClicked}
              disabled={history.length - historyIndex <= 1}
              aria-label="forward"
            >
              <ArrowForward />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("common.up")}>
          <IconButton onClick={handleParentClicked} aria-label="up">
            <ArrowUpward />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("common.refresh")}>
          <IconButton onClick={handleRefleshClicked} aria-label="refresh">
            <Refresh />
          </IconButton>
        </Tooltip>
        <Select
          ref={sortSelectRef}
          size="small"
          value={fileNavigatorSettings.sortOrder}
          sx={{ minWidth: "100px" }}
          onChange={handleSortOrderChanged}
          onClose={handleSortClosed}
          MenuProps={{ slotProps: { transition: { onExited: handleSortMenuExited } } }}
        >
          <MenuItem value={"name_asc"}>
            {t("book-reader.file-navigator.sort-order.name-asc")}
          </MenuItem>
          <MenuItem value={"name_desc"}>
            {t("book-reader.file-navigator.sort-order.name-desc")}
          </MenuItem>
          <MenuItem value={"date_asc"}>
            {t("book-reader.file-navigator.sort-order.date-asc")}
          </MenuItem>
          <MenuItem value={"date_desc"}>
            {t("book-reader.file-navigator.sort-order.date-desc")}
          </MenuItem>
        </Select>
      </Box>
      <OutlinedInput
        type="search"
        inputRef={searchInputRef}
        value={searchText}
        onChange={handleSearchTextChanged}
        onKeyDown={handleSearchKeyDown}
        onContextMenu={handleContextMenu}
        size="small"
        fullWidth
        sx={{
          paddingLeft: "4px",
          "& .MuiOutlinedInput-input": {
            padding: "4px 8px 4px 4px",
          },
        }}
        startAdornment={
          <InputAdornment position="start" sx={{ marginRight: "0px" }}>
            <Search />
          </InputAdornment>
        }
      />
    </Stack>
  );
}
