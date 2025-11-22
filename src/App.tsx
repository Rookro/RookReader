import { createTheme, Stack, ThemeProvider, useMediaQuery } from "@mui/material";
import { Panel, PanelGroup, PanelResizeHandle, } from "react-resizable-panels";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import "./App.css";

function App() {

  const theme = createTheme({
    palette: {
      mode: useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light'
    }
  })

  return (
    <ThemeProvider theme={theme}>
      <Stack className="container">
        <NavigationBar />
        <PanelGroup direction="horizontal" autoSaveId="main_panel_group">
          <Panel className="left_panel" defaultSize={20}>
            <LeftPane />
          </Panel>
          <PanelResizeHandle />
          <Panel className="main_panel">
            <ImageViewer />
          </Panel>
        </PanelGroup>
        <ControlSlider />
      </Stack>
    </ThemeProvider>
  );
}

export default App;
