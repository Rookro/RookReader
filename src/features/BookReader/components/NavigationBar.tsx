import {
  ArrowBack,
  ArrowForward,
  LocalLibrary,
  LooksOne,
  LooksTwo,
  Settings,
  SwitchLeft,
  SwitchRight,
} from "@mui/icons-material";
import { Box, IconButton, OutlinedInput, Toolbar, Tooltip } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import React, { useCallback } from "react";
import { goBackContainerHistory, goForwardContainerHistory, setContainerFilePath } from "../slice";
import { setActiveView } from "../../MainView/slice";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { openSettingsWindow } from "../../../utils/WindowOpener";
import { useTranslation } from "react-i18next";
import { updateSettings } from "../../Settings/slice";
import { Direction } from "../../../types/AppSettings";

/**
 * Navigation bar component.
 */
export default function NavigationBar() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const { history, historyIndex } = useAppSelector((state) => state.read.containerFile);
  const dispatch = useAppDispatch();

  const currentPath = history[historyIndex] ?? "";

  const formAction = useCallback(
    (formData: FormData) => {
      const inputPath = formData.get("path")?.toString();

      if (inputPath && inputPath !== currentPath) {
        dispatch(setContainerFilePath(inputPath));
      }
    },
    [dispatch, currentPath],
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.form?.requestSubmit();
  }, []);

  const handleSwitchTwoPagedClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      const newReaderSettings = {
        ...readerSettings,
        comic: { ...readerSettings.comic, enableSpread: !readerSettings.comic.enableSpread },
      };
      dispatch(updateSettings({ key: "reader", value: newReaderSettings }));
    },
    [dispatch, readerSettings],
  );

  const handleSwitchDirectionClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      const newDirection: Direction =
        readerSettings.comic.readingDirection === "rtl" ? "ltr" : "rtl";
      const newReaderSettings = {
        ...readerSettings,
        comic: { ...readerSettings.comic, readingDirection: newDirection },
      };
      dispatch(updateSettings({ key: "reader", value: newReaderSettings }));
    },
    [dispatch, readerSettings],
  );

  const handleLibraryClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(setActiveView("bookshelf"));
    },
    [dispatch],
  );

  const handleBackClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(goBackContainerHistory());
    },
    [dispatch],
  );

  const handleForwardClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(goForwardContainerHistory());
    },
    [dispatch],
  );

  const handleSettingsClicked = useCallback(async (_e: React.MouseEvent<HTMLButtonElement>) => {
    debug("handleSettingsClicked");
    openSettingsWindow();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <Toolbar variant="dense" disableGutters sx={{ minHeight: "40px" }}>
      <Tooltip title={t("book-reader.move-to-bookshelf")}>
        <IconButton onClick={handleLibraryClicked} aria-label="library">
          <LocalLibrary />
        </IconButton>
      </Tooltip>
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
          inputProps={{ "aria-label": "container-path-input" }}
          sx={{
            bgcolor: (theme) => theme.palette.background.default,
            "& .MuiOutlinedInput-input": {
              padding: "4px 8px",
            },
          }}
        />
      </Box>
      <IconButton onClick={handleSwitchTwoPagedClicked} aria-label="toggle-two-paged">
        {readerSettings.comic.enableSpread ? <LooksTwo /> : <LooksOne />}
      </IconButton>
      <IconButton onClick={handleSwitchDirectionClicked} aria-label="toggle-direction">
        {readerSettings.comic.readingDirection === "rtl" ? <SwitchRight /> : <SwitchLeft />}
      </IconButton>
      <IconButton onClick={handleSettingsClicked} aria-label="settings">
        <Settings />
      </IconButton>
    </Toolbar>
  );
}
