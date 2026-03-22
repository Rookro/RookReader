import { Box, debounce, Stack, SxProps, Theme } from "@mui/material";
import { Explore, History, PhotoLibrary } from "@mui/icons-material";
import { JSX, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { error } from "@tauri-apps/plugin-log";
import { Allotment } from "allotment";
import { setPdfRenderingHeight } from "../../bindings/ContainerCommands";
import { openContainerFile, setContainerFilePath } from "../../reducers/ReadReducer";
import { setEnablePreview, setIsFirstPageSingleView } from "../../reducers/ViewReducer";
import { AppDispatch, useAppSelector } from "../../Store";
import { getRecentlyReadBooks } from "../../bindings/BookCommands";
import { useDragDropEvent } from "../../hooks/useDragDropEvent";

const SideTabs = lazy(() => import("../SidePane/SideTabs"));
const SidePanels = lazy(() => import("../SidePane/SidePanels"));
const ControlSlider = lazy(() => import("./ControlSlider"));
const NavigationBar = lazy(() => import("./NavigationBar"));
const FileNavigator = lazy(() => import("./FileNavigator/FileNavigator"));
const ImageEntriesViewer = lazy(() => import("./ImageEntriesViewer/ImageEntriesViewer"));
const HistoryViewer = lazy(() => import("./HistoryViewer/HistoryViewer"));
const ComicReader = lazy(() => import("./ComicReader"));
const NovelReader = lazy(() => import("./NovelReader"));

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
  const { enableHistory, activeView } = useAppSelector((state) => state.view);
  const { isHidden, tabIndex } = useAppSelector((state) => state.sidePane.left);
  const { history, historyIndex, isNovel } = useAppSelector((state) => state.read.containerFile);
  const settings = useAppSelector((state) => state.settings);
  const dispatch = useDispatch<AppDispatch>();

  const [droppedFile, setDroppedFile] = useState<string | undefined>(undefined);

  const paneSizes = useMemo<number[] | undefined>(() => {
    const storedSizes = localStorage.getItem("book-reader-left-pane-sizes");
    if (storedSizes) {
      try {
        const sizes = JSON.parse(storedSizes);
        if (Array.isArray(sizes) && sizes.every((size) => typeof size === "number")) {
          return sizes;
        }
      } catch (ex) {
        error(`Failed to parse book-reader-left-pane-sizes: ${ex}`);
      }
    }
    return undefined;
  }, []);

  const handlePaneSizeChanged = useMemo(
    () =>
      debounce((sizes: number[]) => {
        localStorage.setItem("book-reader-left-pane-sizes", JSON.stringify(sizes));
      }, 500),
    [],
  );

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

    if (enableHistory) {
      tabs.push({ label: "history", icon: <History />, panel: <HistoryViewer /> });
    }
    return tabs;
  }, [enableHistory]);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    const init = async () => {
      const isFirstSingle = settings["first-page-single-view"];
      dispatch(setIsFirstPageSingleView(isFirstSingle));

      const renderingSettings = settings.rendering;
      dispatch(setEnablePreview(renderingSettings["enable-preview"]));

      const height = renderingSettings["pdf-rendering-height"];
      if (height) {
        await setPdfRenderingHeight(height);
      }

      const historySettings = settings.history;
      const historyEnabled = historySettings.enable;
      const restoreLastContainer = historySettings["restore-last-container-on-startup"];
      if (historyEnabled && restoreLastContainer) {
        const latestEntry =
          (await getRecentlyReadBooks()).length > 0 ? (await getRecentlyReadBooks())[0] : null;
        if (latestEntry) {
          dispatch(setContainerFilePath(latestEntry.file_path));
        }
      }

      initialized.current = true;
    };
    init();
  }, [dispatch, settings]);

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
        <SideTabs tabs={tabs} tabIndex={tabIndex} isHidden={isHidden} />
        <Box sx={{ flex: 1 }}>
          <Allotment
            defaultSizes={paneSizes}
            proportionalLayout={false}
            onChange={handlePaneSizeChanged}
          >
            <Allotment.Pane preferredSize={320} minSize={210} visible={!isHidden}>
              <SidePanels tabs={tabs} tabIndex={tabIndex} />
            </Allotment.Pane>
            <Allotment.Pane>
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: (theme) => theme.palette.background.default,
                }}
              >
                {isNovel ? <NovelReader filePath={containerPath} /> : <ComicReader />}
              </Box>
            </Allotment.Pane>
          </Allotment>
        </Box>
      </Stack>
      <ControlSlider />
    </Stack>
  );
}
