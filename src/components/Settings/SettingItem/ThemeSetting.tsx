import { useState } from "react";
import { Box, FormControl, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import { app } from "@tauri-apps/api"
import { Theme } from "@tauri-apps/api/window";
import { LazyStore } from '@tauri-apps/plugin-store';

const toTauriTheme = new Map<string, Theme | undefined>([
    ["System", undefined],
    ["Dark", "dark"],
    ["Light", "light"],
]);

function ThemeSetting() {
    const [theme, setTheme] = useState("System");

    const store = new LazyStore("rook-reader_settings.json");

    const handleThemeChanged = async (e: SelectChangeEvent) => {
        setTheme(e.target.value);
        store.set("theme", toTauriTheme.get(e.target.value));
        await app.setTheme(toTauriTheme.get(e.target.value));
    }

    return (
        <Box className="theme-setting" display="flex">
            <Typography alignContent="center">Theme</Typography>
            <FormControl sx={{ m: 1, minWidth: 200 }} size="small">
                <Select
                    value={theme}
                    onChange={handleThemeChanged}
                    displayEmpty
                    inputProps={{ 'aria-label': 'Without label' }}
                >
                    <MenuItem value="System">System Theme</MenuItem>
                    <MenuItem value="Light">Light</MenuItem>
                    <MenuItem value="Dark">Dark</MenuItem>
                </Select>
            </FormControl>
        </Box>
    );
}

export default ThemeSetting;
