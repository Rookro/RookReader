import { CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { useAppTheme } from "./hooks/useAppTheme";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import NavigationBar from "./components/NavigationBar/NavigationBar";
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
        <Stack
          sx={{
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            bgcolor: (theme) => theme.palette.background.paper,
          }}
        >
          <NavigationBar />
          <MainContent
            sx={{
              width: "100%",
              minHeight: 0,
              flex: 1,
            }}
          />
          <ControlSlider />
        </Stack>
      </NotificationProvider>
    </ThemeProvider>
  );
}
