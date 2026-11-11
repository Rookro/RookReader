import { CssBaseline, ThemeProvider } from "@mui/material";
import ErrorNotifier from "./components/ui/ErrorNotifier";
import NotificationProvider from "./components/ui/Notification/NotificationContext";
import MainView from "./features/MainView/components/MainView";
import { useAppTheme } from "./hooks/useAppTheme";

export default function App() {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <ErrorNotifier />
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
