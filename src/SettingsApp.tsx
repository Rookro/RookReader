import GeneralSettings from "./components/Settings/GeneralSettings";
import LeftPane from "./components/Settings/LeftPane/LeftPane";
import "./App.css"
import "./SettingsApp.css"
import { createTheme, ThemeProvider, useMediaQuery } from "@mui/material";

function SettingsApp() {
    const theme = createTheme({
        palette: {
            mode: useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light'
        }
    })

    return (
        <ThemeProvider theme={theme}>
            <div className="settings-view">
                <LeftPane />
                <GeneralSettings />
            </div>
        </ThemeProvider>
    );
}

export default SettingsApp;
