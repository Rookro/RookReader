import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import SettingsView from "./components/Settings/SettingsView";
import { useAppTheme } from "./hooks/useAppTheme";

function SettingsApp() {
    const theme = useAppTheme();

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box
                sx={{
                    width: 'calc(100vw - 8px)',
                    height: 'calc(100vh - 8px)',
                    margin: '4px',
                }}
            >
                <SettingsView />
            </Box>

        </ThemeProvider>
    );
}

export default SettingsApp;
