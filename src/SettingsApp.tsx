import "./App.css"
import { createTheme, ThemeProvider, useMediaQuery } from "@mui/material";
import SettingsView from "./components/Settings/SettingsView";

function SettingsApp() {
    const theme = createTheme({
        palette: {
            mode: useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light'
        }
    })

    return (
        <ThemeProvider theme={theme}>
            <SettingsView />
        </ThemeProvider>
    );
}

export default SettingsApp;
