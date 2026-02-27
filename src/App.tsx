import { CssBaseline, ThemeProvider } from "@mui/material";
import { useAppTheme } from "./hooks/useAppTheme";
import MainContent from "./components/MainContent/MainContent";
import NotificationProvider from "./components/Notification/NotificationContext";
import GlobalErrorListener from "./components/GlobalErrorListener";

export default function App() {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <GlobalErrorListener />
        <MainContent
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
