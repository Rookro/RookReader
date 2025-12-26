import { useCallback } from "react";
import { CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { Panel, PanelGroup, PanelResizeHandle, } from "react-resizable-panels";
import { debug } from "@tauri-apps/plugin-log";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import { useAppTheme } from "./hooks/useAppTheme";
import { useTauriEvent } from "./hooks/useTauriEvent";
import { useAppDispatch } from "./Store";
import { setIsFirstPageSingleView } from "./reducers/ViewReducer";
import i18n from "./i18n/config";

export default function App() {
  const theme = useAppTheme();
  const dispatch = useAppDispatch();

  const handleLanguageChanged = useCallback((event: { payload: { language: string } }) => {
    debug(`Received language changed event: ${event.payload.language}`);
    i18n.changeLanguage(event.payload.language);
  }, []);
  useTauriEvent<{ language: string }>('i18n-language-changed', handleLanguageChanged);

  // The Store state is isolated within each WebView context.
  // Changes dispatched in the settings window (via dispatch()) will not be reflected in the main window.
  //
  // Listen for the 'view-settings-changed' event notified by the settings window (SettingsApp) to apply the changes.
  const handleViewSettingsChanged = useCallback((event: { payload: { key: string, value: unknown } }) => {
    const payload = event.payload;
    debug(`Received view settings changed event: ${JSON.stringify(payload)}`);
    if (payload.key === 'isFirstPageSingleView' && typeof payload.value === 'boolean') {
      dispatch(setIsFirstPageSingleView(payload.value));
    }
  }, [dispatch]);
  useTauriEvent<{ key: string, value: unknown }>('view-settings-changed', handleViewSettingsChanged);

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
