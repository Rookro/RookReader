import { ArrowBack, ArrowForward, ArrowUpward, Home, Refresh, Search } from "@mui/icons-material";
import {
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
} from "@mui/material";
import { dirname, homeDir } from "@tauri-apps/api/path";
import { warn } from "@tauri-apps/plugin-log";
import React, { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { type AppDispatch, useAppSelector } from "../../../../store/store";
import type { SortOrder } from "../../../../types/AppSettings";
import { updateSettings } from "../../../Settings/slice";
import {
  goBackExplorerHistory,
  goForwardExplorerHistory,
  setSearchText,
  updateExploreBasePath,
} from "../../slice";

/**
 * Navigation bar component for File navigator component.
 */
export default function NavBar() {
  const { t } = useTranslation();
  const { history, historyIndex, searchText, entries } = useAppSelector(
    (state) => state.read.explorer,
  );
  const fileNavigatorSettings = useAppSelector((state) => state.settings.fileNavigator);
  const dispatch = useDispatch<AppDispatch>();

  const [width, setWidth] = React.useState(0);

  const navButtonsRef = useRef<HTMLElement>(null);

  const currentPath = history[historyIndex] ?? "";

  const setDirParh = useCallback(
    async (dirPath: string | undefined = undefined) => {
      if (!dirPath) {
        dirPath = fileNavigatorSettings.homeDirectory || (await homeDir());
      }
      dispatch(setSearchText(""));
      dispatch(updateExploreBasePath({ dirPath }));
    },
    [dispatch, fileNavigatorSettings.homeDirectory],
  );

  useEffect(() => {
    if (entries.length === 0) {
      const dirPath = historyIndex === -1 ? undefined : history[historyIndex];
      setDirParh(dirPath);
    }

    const element = navButtonsRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setWidth(element?.offsetWidth ?? 0);
    });
    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [entries.length, historyIndex, history, setDirParh]);

  const formAction = useCallback(
    (formData: FormData) => {
      const inputPath = formData.get("path")?.toString();

      if (inputPath && inputPath !== currentPath) {
        dispatch(setSearchText(""));
        dispatch(updateExploreBasePath({ dirPath: inputPath }));
      }
    },
    [dispatch, currentPath],
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.form?.requestSubmit();
  }, []);

  const handleHomeClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      setDirParh();
    },
    [setDirParh],
  );

  const handleParentClicked = useCallback(
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
      try {
        const parentDir = await dirname(history[historyIndex]);
        dispatch(updateExploreBasePath({ dirPath: parentDir }));
      } catch (e) {
        warn(`Failed to get parent directory of ${history[historyIndex]}. Error: ${e}.`);
      }
    },
    [dispatch, history, historyIndex],
  );

  const handleRefleshClicked = useCallback(
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(updateExploreBasePath({ dirPath: history[historyIndex], forceUpdate: true }));
    },
    [dispatch, history, historyIndex],
  );

  const handleSearchTextChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setSearchText(e.target.value));
    },
    [dispatch],
  );

  const handleBackClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(goBackExplorerHistory());
    },
    [dispatch],
  );

  const handleForwardClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(goForwardExplorerHistory());
    },
    [dispatch],
  );

  const handleSortOrderChanged = useCallback(
    (event: SelectChangeEvent) => {
      const newFileNavigatorSettings = {
        ...fileNavigatorSettings,
        sortOrder: event.target.value as SortOrder,
      };
      dispatch(updateSettings({ key: "fileNavigator", value: newFileNavigatorSettings }));
    },
    [dispatch, fileNavigatorSettings],
  );

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
        ref={navButtonsRef}
        sx={{
          "& .MuiIconButton-root": {
            color: (theme) => theme.palette.primary.main,
          },
          "& .MuiIconButton-root.Mui-disabled": {
            color: (theme) => theme.palette.action.disabled,
          },
        }}
      >
        <IconButton onClick={handleHomeClicked} aria-label="home">
          <Home />
        </IconButton>
        <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0} aria-label="back">
          <ArrowBack />
        </IconButton>
        <IconButton
          onClick={handleForwardClicked}
          disabled={history.length - historyIndex <= 1}
          aria-label="forward"
        >
          <ArrowForward />
        </IconButton>
        <IconButton onClick={handleParentClicked} aria-label="up">
          <ArrowUpward />
        </IconButton>
        <IconButton onClick={handleRefleshClicked} aria-label="refresh">
          <Refresh />
        </IconButton>
        {width >= 310 && (
          <Select
            size="small"
            defaultValue={fileNavigatorSettings.sortOrder}
            sx={{ minWidth: "100px" }}
            onChange={handleSortOrderChanged}
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
        )}
      </Box>
      <OutlinedInput
        type="search"
        value={searchText}
        onChange={handleSearchTextChanged}
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
