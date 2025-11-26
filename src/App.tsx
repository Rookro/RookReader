import { CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { Panel, PanelGroup, PanelResizeHandle, } from "react-resizable-panels";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import { useAppTheme } from "./hooks/useAppTheme";

export default function App() {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack sx={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <NavigationBar />
        <PanelGroup direction="horizontal" autoSaveId="main_panel_group">
          <Panel defaultSize={20}>
            <LeftPane />
          </Panel>
          <PanelResizeHandle
            style={{
              width: '4px',
              backgroundColor: theme.palette.divider,
            }}
          />
          <Panel style={{ display: 'flex' }} >
            <ImageViewer />
          </Panel>
        </PanelGroup>
        <ControlSlider />
      </Stack>
    </ThemeProvider >
  );
};
