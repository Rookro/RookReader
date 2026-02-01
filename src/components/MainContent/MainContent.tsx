import { JSX, useMemo } from "react";
import { Box, debounce, Stack, SxProps } from "@mui/material";
import { History, PhotoLibrary, ViewList } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { Allotment } from "allotment";
import { useHistoryUpdater } from "../../hooks/useHistoryUpdater";
import { useSettingsChange } from "../../hooks/useSettingsChange";
import BookReader from "../BookReader/BookReader";
import SideTabs from "../SidePane/SideTabs";
import SidePanels from "../SidePane/SidePanels";
import FileNavigator from "../FileNavigator/FileNavigator";
import ImageEntriesViewer from "../ImageEntriesViewer/ImageEntriesViewer";
import HistoryViewer from "../../components/HistoryViewer/HistoryViewer";
import { useAppSelector } from "../../Store";

/**
 * Main content component
 */
export default function MainContent(props?: { sx?: SxProps }) {
  useHistoryUpdater();
  useSettingsChange();

  const { isHistoryEnabled } = useAppSelector((state) => state.history);
  const { isHidden, tabIndex } = useAppSelector((state) => state.sidePane.left);

  const paneSizes = useMemo<number[] | undefined>(() => {
    const storedSizes = localStorage.getItem("main-content-pane-sizes");
    if (storedSizes) {
      try {
        const sizes = JSON.parse(storedSizes);
        if (Array.isArray(sizes) && sizes.every((size) => typeof size === "number")) {
          return sizes;
        }
      } catch (ex) {
        error(`Failed to parse main-content-pane-sizes: ${ex}`);
      }
    }
    return undefined;
  }, []);

  const handlePaneSizeChanged = useMemo(
    () =>
      debounce((sizes: number[]) => {
        localStorage.setItem("main-content-pane-sizes", JSON.stringify(sizes));
      }, 500),
    [],
  );

  const tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[] = useMemo(() => {
    const tabs = [
      { label: "file-navigator", icon: <ViewList />, panel: <FileNavigator /> },
      { label: "image-entries", icon: <PhotoLibrary />, panel: <ImageEntriesViewer /> },
    ];

    if (isHistoryEnabled) {
      tabs.push({ label: "history", icon: <History />, panel: <HistoryViewer /> });
    }
    return tabs;
  }, [isHistoryEnabled]);

  return (
    <Stack direction="row" sx={props?.sx}>
      <SideTabs tabs={tabs} tabIndex={tabIndex} isHidden={isHidden} />
      <Box sx={{ flex: 1 }}>
        <Allotment
          defaultSizes={paneSizes}
          proportionalLayout={false}
          onChange={handlePaneSizeChanged}
        >
          <Allotment.Pane preferredSize={315} minSize={210} visible={!isHidden}>
            <SidePanels tabs={tabs} tabIndex={tabIndex} />
          </Allotment.Pane>
          <Allotment.Pane>
            <BookReader />
          </Allotment.Pane>
        </Allotment>
      </Box>
    </Stack>
  );
}
