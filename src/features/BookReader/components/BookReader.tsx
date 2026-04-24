import { Explore, History, PhotoLibrary } from "@mui/icons-material";
import { Box, CircularProgress, Stack, type SxProps, type Theme } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { Allotment } from "allotment";
import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRecentlyReadBooks } from "../../../bindings/BookCommands";
import { useDragDropEvent } from "../../../hooks/useDragDropEvent";
import { usePaneSizes } from "../../../hooks/usePaneSizes";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import SidePanels from "../../SidePane/components/SidePanels";
import SideTabs from "../../SidePane/components/SideTabs";
import { openContainerFile, setContainerFilePath } from "../slice";
import ComicReader from "./ComicReader";
import ControlSlider from "./ControlSlider";
import FileNavigator from "./FileNavigator/FileNavigator";
import HistoryViewer from "./HistoryViewer/HistoryViewer";
import ImageEntriesViewer from "./ImageEntriesViewer/ImageEntriesViewer";
import NavigationBar from "./NavigationBar";
import NovelReader from "./NovelReader";

const selectBookReaderState = createSelector(
  [
    (state: RootState) => state.view.activeView,
    (state: RootState) => state.sidePane.left,
    (state: RootState) => state.read.containerFile,
    (state: RootState) => state.settings.history,
    (state: RootState) => state.settings.startup,
  ],
  (activeView, leftPane, containerFile, historySettings, startupSettings) => ({
    activeView,
    isHidden: leftPane.isHidden,
    tabIndex: leftPane.tabIndex,
    history: containerFile.history,
    historyIndex: containerFile.historyIndex,
    isNovel: containerFile.isNovel,
    isLoading: containerFile.isLoading,
    historySettings,
    startupSettings,
  }),
);

/**
 * Props for the BookReader component
 */
export interface BookReaderProps {
  /** Styles for the BookReader component */
  sx?: SxProps<Theme>;
}

/**
 * Component for rendering a book reader.
 */
export default function BookReader({ sx }: BookReaderProps) {
  const initialized = useRef(false);
  const {
    activeView,
    isHidden,
    tabIndex,
    history,
    historyIndex,
    isNovel,
    isLoading,
    historySettings,
    startupSettings,
  } = useAppSelector(selectBookReaderState);
  const dispatch = useAppDispatch();

  const [droppedFile, setDroppedFile] = useState<string | undefined>(undefined);

  const { paneSizes, handlePaneSizeChanged } = usePaneSizes("book-reader-left-pane-sizes");

  const handleDropped = useCallback(
    (paths: string[]) => {
      if (activeView === "reader") {
        if (paths && paths.length > 0) {
          setDroppedFile(paths[0]);
        }
      }
    },
    [activeView],
  );
  useDragDropEvent({ onDrop: handleDropped });

  const tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[] = useMemo(() => {
    const tabs = [
      { label: "file-navigator", icon: <Explore />, panel: <FileNavigator /> },
      { label: "image-entries", icon: <PhotoLibrary />, panel: <ImageEntriesViewer /> },
    ];

    if (historySettings.recordReadingHistory) {
      tabs.push({ label: "history", icon: <History />, panel: <HistoryViewer /> });
    }
    return tabs;
  }, [historySettings.recordReadingHistory]);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    const init = async () => {
      const historyEnabled = historySettings.recordReadingHistory;
      const restoreLastContainer = startupSettings.restoreLastBook;
      if (historyEnabled && restoreLastContainer) {
        const recentBooks = await getRecentlyReadBooks();
        const latestEntry = recentBooks.length > 0 ? recentBooks[0] : null;
        if (latestEntry) {
          dispatch(setContainerFilePath(latestEntry.file_path));
        }
      }

      initialized.current = true;
    };
    init();
  }, [dispatch, historySettings.recordReadingHistory, startupSettings.restoreLastBook]);

  const containerPath = history[historyIndex];

  useEffect(() => {
    if (containerPath) {
      dispatch(openContainerFile(containerPath));
    }
  }, [containerPath, dispatch]);

  useEffect(() => {
    if (droppedFile && droppedFile.length > 0) {
      dispatch(setContainerFilePath(droppedFile));
    }
  }, [droppedFile, dispatch]);

  return (
    <Stack
      direction="column"
      sx={{ width: "100%", height: "100%", ...sx }}
      data-testid="book-reader"
    >
      <NavigationBar />
      <Stack direction="row" sx={{ width: "100%", height: "100%" }}>
        <SideTabs tabs={tabs} index={tabIndex} isHidden={isHidden} />
        <Box sx={{ flex: 1 }}>
          <Allotment
            defaultSizes={paneSizes}
            proportionalLayout={false}
            onChange={handlePaneSizeChanged}
          >
            <Allotment.Pane preferredSize={320} minSize={210} visible={!isHidden}>
              <SidePanels tabs={tabs} index={tabIndex} />
            </Allotment.Pane>
            <Allotment.Pane>
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: (theme) => theme.palette.background.default,
                }}
              >
                {isLoading ? (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <CircularProgress />
                  </Box>
                ) : isNovel ? (
                  <NovelReader filePath={containerPath} />
                ) : (
                  <ComicReader />
                )}
              </Box>
            </Allotment.Pane>
          </Allotment>
        </Box>
      </Stack>
      <ControlSlider />
    </Stack>
  );
}
