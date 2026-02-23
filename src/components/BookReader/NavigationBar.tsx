import React, { useCallback, useEffect } from "react";
import { IconButton, OutlinedInput, Toolbar } from "@mui/material";
import {
  ArrowBack,
  ArrowForward,
  LooksOne,
  LooksTwo,
  Settings,
  SwitchLeft,
  SwitchRight,
} from "@mui/icons-material";
import { debug } from "@tauri-apps/plugin-log";
import { Direction } from "../../types/DirectionType";
import { settingsStore } from "../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../Store";
import {
  goBackContainerHistory,
  goForwardContainerHistory,
  setContainerFilePath,
} from "../../reducers/FileReducer";
import { setDirection, setIsTwoPagedView } from "../../reducers/ViewReducer";
import { openSettingsWindow } from "../../utils/WindowOpener";

/**
 * Navigation bar component.
 */
export default function NavigationBar() {
  const { isTwoPagedView, direction } = useAppSelector((state) => state.view);
  const { history, historyIndex } = useAppSelector((state) => state.file.containerFile);
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
      <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0}>
        <ArrowBack />
      </IconButton>
      <IconButton onClick={handleForwardClicked} disabled={history.length - historyIndex <= 1}>
        <ArrowForward />
      </IconButton>
      <OutlinedInput
        value={history[historyIndex] ?? ""}
        onChange={handlePathChanged}
        onContextMenu={handleContextMenu}
        size="small"
        fullWidth
        sx={{
          bgcolor: (theme) => theme.palette.background.default,
          "& .MuiOutlinedInput-input": {
            padding: "4px 8px",
          },
        }}
      />
      <IconButton onClick={handleSwitchTwoPagedClicked}>
        {isTwoPagedView ? <LooksTwo /> : <LooksOne />}
      </IconButton>
      <IconButton onClick={handleSwitchDirectionClicked}>
        {direction === "rtl" ? <SwitchRight /> : <SwitchLeft />}
      </IconButton>
      <IconButton onClick={handleSettingsClicked}>
        <Settings />
      </IconButton>
    </Toolbar>
  );
}
