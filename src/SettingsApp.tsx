import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import SettingsView from "./components/Settings/SettingsView";
import { useAppTheme } from "./hooks/useAppTheme";

export default function SettingsApp() {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          bgcolor: (theme) => theme.palette.background.paper,
        }}
      >
        <SettingsView />
      </Box>
    </ThemeProvider>
  );
}
