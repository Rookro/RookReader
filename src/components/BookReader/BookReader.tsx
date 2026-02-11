import { Box } from "@mui/material";
import { lazy, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { setPdfRenderingHeight } from "../../bindings/ContainerCommands";
import { HistoryTable } from "../../database/historyTable";
import { useFileDrop } from "../../hooks/useFileDrop";
import { openContainerFile, setContainerFilePath } from "../../reducers/FileReducer";
import { setIsFirstPageSingleView } from "../../reducers/ViewReducer";
import { settingsStore } from "../../settings/SettingsStore";
import { AppDispatch, useAppSelector } from "../../Store";
import { HistorySettings } from "../../types/Settings";

const ComicReader = lazy(() => import("./ComicReader"));
const NovelReader = lazy(() => import("./NovelReader"));

/**
 * Component for rendering a book reader.
 */
export default function BookReader() {
  const initialized = useRef(false);
  const { history, historyIndex, isNovel } = useAppSelector((state) => state.file.containerFile);
  const dispatch = useDispatch<AppDispatch>();
  const { droppedFile } = useFileDrop();

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    const init = async () => {
      const isFirstSingle = (await settingsStore.get<boolean>("first-page-single-view")) ?? true;
      dispatch(setIsFirstPageSingleView(isFirstSingle));

      const height = await settingsStore.get<number>("pdf-rendering-height");
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
    <Box
      sx={{
        width: "100%",
        height: "100%",
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      {isNovel ? <NovelReader filePath={containerPath} /> : <ComicReader />}
    </Box>
  );
}
