import { Explore, History, PhotoLibrary } from "@mui/icons-material";
import { Box, debounce, Stack, SxProps, Theme } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { Allotment } from "allotment";
import { JSX, lazy, useEffect, useMemo, useRef } from "react";
import { useDispatch } from "react-redux";
import { setPdfRenderingHeight } from "../../bindings/ContainerCommands";
import { HistoryTable } from "../../database/historyTable";
import { useFileDrop } from "../../hooks/useFileDrop";
import { openContainerFile, setContainerFilePath } from "../../reducers/FileReducer";
import { setEnablePreview, setIsFirstPageSingleView } from "../../reducers/ViewReducer";
import { settingsStore } from "../../settings/SettingsStore";
import { AppDispatch, useAppSelector } from "../../Store";
import { HistorySettings, RenderingSettings } from "../../types/Settings";

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
  const { isHistoryEnabled } = useAppSelector((state) => state.history);
  const { isHidden, tabIndex } = useAppSelector((state) => state.sidePane.left);
  const { history, historyIndex, isNovel } = useAppSelector((state) => state.file.containerFile);
  const dispatch = useDispatch<AppDispatch>();
  const { droppedFile } = useFileDrop();

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

  const tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[] = useMemo(() => {
    const tabs = [
      { label: "file-navigator", icon: <Explore />, panel: <FileNavigator /> },
      { label: "image-entries", icon: <PhotoLibrary />, panel: <ImageEntriesViewer /> },
    ];

    if (isHistoryEnabled) {
      tabs.push({ label: "history", icon: <History />, panel: <HistoryViewer /> });
    }
    return tabs;
  }, [isHistoryEnabled]);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    const init = async () => {
      const isFirstSingle = (await settingsStore.get<boolean>("first-page-single-view")) ?? true;
      dispatch(setIsFirstPageSingleView(isFirstSingle));

      const renderingSettings = await settingsStore.get<RenderingSettings>("rendering");
      dispatch(setEnablePreview(renderingSettings?.["enable-preview"] ?? true));

      const height = renderingSettings?.["pdf-rendering-height"];
      if (height) {
        await setPdfRenderingHeight(height);
      }

      const historySettings = await settingsStore.get<HistorySettings>("history");
      const historyEnabled = historySettings?.enable ?? true;
      const restoreLastContainer = historySettings?.["restore-last-container-on-startup"] ?? true;
      if (historyEnabled && restoreLastContainer) {
        const historyTable = new HistoryTable();
        await historyTable.init();
        const latestEntry = await historyTable.selectLatestLastOpenedAt();
        if (latestEntry) {
          dispatch(setContainerFilePath(latestEntry.path));
        }
      }

      initialized.current = true;
    };
    init();
  }, [dispatch]);

  const containerPath = history[historyIndex];

  useEffect(() => {
    if (containerPath) {
      dispatch(openContainerFile(containerPath));
    }
  }, [containerPath, dispatch]);

  useEffect(() => {
    const handleFileDroped = async () => {
      if (droppedFile && droppedFile.length > 0) {
        dispatch(setContainerFilePath(droppedFile));
      }
    };
    handleFileDroped();
  }, [droppedFile, dispatch]);

  return (
    <Stack direction="column" sx={{ width: "100%", height: "100%", ...sx }}>
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
