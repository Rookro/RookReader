import { CssBaseline, ThemeProvider } from "@mui/material";
import GlobalErrorListener from "./components/ui/GlobalErrorListener";
import NotificationProvider from "./components/ui/Notification/NotificationContext";
import MainView from "./features/MainView/components/MainView";
import { useAppTheme } from "./hooks/useAppTheme";

export default function App() {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <GlobalErrorListener />
        <MainView
          sx={{
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            bgcolor: (theme) => theme.palette.background.paper,
          }}
        />
      </NotificationProvider>
    </ThemeProvider>
  );
}
