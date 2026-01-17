import { JSX, useMemo } from "react";
import { Stack, SxProps, useTheme } from "@mui/material";
import { History, PhotoLibrary, ViewList } from "@mui/icons-material";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import ImageViewer from "../ImageViewer/ImageViewer";
import SidePanels from "../SidePane/SidePanels";
import { useHistoryUpdater } from "../../hooks/useHistoryUpdater";
import { useSettingsChange } from "../../hooks/useSettingsChange";
import SideTabs from "../SidePane/SideTabs";
import FileNavigator from "../FileNavigator/FileNavigator";
import ImageEntriesViewer from "../ImageEntriesViewer/ImageEntriesViewer";
import HistoryViewer from "../../components/HistoryViewer/HistoryViewer";
import { useAppSelector } from "../../Store";

/**
 * Main content component
 */
export default function MainContent(props?: { sx?: SxProps }) {
  const theme = useTheme();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    groupId: "main_panel_group",
    storage: localStorage,
  });
  useHistoryUpdater();
  useSettingsChange();

  const { isHistoryEnabled } = useAppSelector((state) => state.history);
  const { isHidden, tabIndex } = useAppSelector((state) => state.sidePane.left);

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
      <Group orientation="horizontal" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {isHidden || (
          <>
            <Panel id="left-panel" defaultSize={210} minSize={210}>
              <SidePanels tabs={tabs} tabIndex={tabIndex} />
            </Panel>
            <Separator
              style={{
                width: "2px",
                backgroundColor: theme.palette.divider,
                outline: "none",
              }}
            />
          </>
        )}
        <Panel
          id="image-viewer-panel"
          style={{ display: "flex", background: theme.palette.background.default }}
        >
          <ImageViewer />
        </Panel>
      </Group>
    </Stack>
  );
}
