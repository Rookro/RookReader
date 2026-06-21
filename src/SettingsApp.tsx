import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import NotificationProvider from "./components/ui/Notification/NotificationContext";
import SettingsErrorListener from "./features/Settings/components/SettingsErrorListener";
import SettingsView from "./features/Settings/components/SettingsView";
import { useAppTheme } from "./hooks/useAppTheme";

export default function SettingsApp() {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <SettingsErrorListener />
        <Box
          sx={{
            width: "100vw",
            height: "100vh",
            bgcolor: (theme) => theme.palette.background.paper,
          }}
        >
          <SettingsView />
        </Box>
      </NotificationProvider>
    </ThemeProvider>
  );
}
