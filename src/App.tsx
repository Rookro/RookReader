import { useEffect, useRef } from "react";
import { CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { Panel, PanelGroup, PanelResizeHandle, } from "react-resizable-panels";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import { useAppTheme } from "./hooks/useAppTheme";
import i18n from "./i18n/config";

export default function App() {
  const theme = useAppTheme();
  const unlistenRef = useRef<UnlistenFn>(null);

  useEffect(() => {
    const listenLanguageChangedEvent = async () => {
      const unlisten = await listen<{ language: string }>('i18n-language-changed', (event) => {
        debug(`Received language changed event: ${event.payload.language}`);
        i18n.changeLanguage(event.payload.language);
      })
      unlistenRef.current?.();
      unlistenRef.current = unlisten;
    };
    listenLanguageChangedEvent();

    return () => {
      unlistenRef.current?.();
    }
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack sx={{ width: '100vw', height: '100vh', overflow: 'hidden', bgcolor: (theme) => theme.palette.background.paper }}>
        <NavigationBar />
        <PanelGroup direction="horizontal" autoSaveId="main_panel_group">
          <Panel defaultSize={20}>
            <LeftPane />
          </Panel>
          <PanelResizeHandle
            style={{
              width: '2px',
              backgroundColor: theme.palette.divider,
            }}
          />
          <Panel style={{ display: 'flex', background: theme.palette.background.default }}>
            <ImageViewer />
          </Panel>
        </PanelGroup>
        <ControlSlider />
      </Stack>
    </ThemeProvider >
  );
};
