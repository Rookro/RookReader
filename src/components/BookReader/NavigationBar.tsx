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
import { IconButton, OutlinedInput, Toolbar, Tooltip } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import React, { useCallback, useEffect } from "react";
import {
  goBackContainerHistory,
  goForwardContainerHistory,
  setContainerFilePath,
} from "../../reducers/ReadReducer";
import { setActiveView, setDirection, setIsTwoPagedView } from "../../reducers/ViewReducer";
import { settingsStore } from "../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../Store";
import { Direction } from "../../types/DirectionType";
import { openSettingsWindow } from "../../utils/WindowOpener";
import { useTranslation } from "react-i18next";

/**
 * Navigation bar component.
 */
export default function NavigationBar() {
  const { t } = useTranslation();
  const { isTwoPagedView, direction } = useAppSelector((state) => state.view);
  const { history, historyIndex } = useAppSelector((state) => state.read.containerFile);
  const dispatch = useAppDispatch();

  const handlePathChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setContainerFilePath(e.target.value));
  };

  const handleSwitchTwoPagedClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
    settingsStore.set("two-paged", !isTwoPagedView);
    dispatch(setIsTwoPagedView(!isTwoPagedView));
  };

  const handleSwitchDirectionClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
    if (direction === "rtl") {
      settingsStore.set("direction", "ltr");
      dispatch(setDirection("ltr"));
    } else {
      settingsStore.set("direction", "rtl");
      dispatch(setDirection("rtl"));
    }
  };

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

  useEffect(() => {
    const initViewSettings = async () => {
      const direction = await settingsStore.get<Direction>("direction");
      const isTwoPaged = await settingsStore.get<boolean>("two-paged");
      if (direction) {
        dispatch(setDirection(direction));
      }
      if (isTwoPaged !== undefined) {
        dispatch(setIsTwoPagedView(isTwoPaged));
      }
    };
    initViewSettings();
  }, [dispatch]);

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
      <OutlinedInput
        value={history[historyIndex] ?? ""}
        onChange={handlePathChanged}
        onContextMenu={handleContextMenu}
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
      <IconButton onClick={handleSwitchTwoPagedClicked} aria-label="toggle-two-paged">
        {isTwoPagedView ? <LooksTwo /> : <LooksOne />}
      </IconButton>
      <IconButton onClick={handleSwitchDirectionClicked} aria-label="toggle-direction">
        {direction === "rtl" ? <SwitchRight /> : <SwitchLeft />}
      </IconButton>
      <IconButton onClick={handleSettingsClicked} aria-label="settings">
        <Settings />
      </IconButton>
    </Toolbar>
  );
}
