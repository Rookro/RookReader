import { CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import { useAppTheme } from "./hooks/useAppTheme";
import { useHistoryUpdater } from "./hooks/useHistoryUpdater";
import { useSettingsChange } from "./hooks/useSettingsChange";

export default function App() {
  const theme = useAppTheme();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    groupId: "main_panel_group",
    storage: localStorage,
  });

  useHistoryUpdater();
  useSettingsChange();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack
        sx={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          bgcolor: (theme) => theme.palette.background.paper,
        }}
      >
        <NavigationBar />
        <Group
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChange={onLayoutChange}
        >
          <Panel defaultSize={250} minSize={250}>
            <LeftPane />
          </Panel>
          <Separator
            style={{
              width: "2px",
              backgroundColor: theme.palette.divider,
              outline: "none",
            }}
          />
          <Panel style={{ display: "flex", background: theme.palette.background.default }}>
            <ImageViewer />
          </Panel>
        </Group>
        <ControlSlider />
      </Stack>
    </ThemeProvider>
  );
}
