import { useEffect, useState } from "react";
import { Box, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import { app } from "@tauri-apps/api"
import { Theme } from "@tauri-apps/api/window";
import { settingsStore } from "../../../../settings/SettingsStore";

/** 
 * テーマ名と Tauri のテーマ設定値のマッピング
 */
const toTauriTheme = new Map<string, Theme | undefined>([
    ["system", undefined],
    ["dark", "dark"],
    ["light", "light"],
]);

/**
 * テーマ設定コンポーネント
 */
export default function ThemeSetting() {
    const [theme, setTheme] = useState("system");

    const handleThemeChanged = async (e: SelectChangeEvent) => {
        setTheme(e.target.value);
        settingsStore.set("theme", e.target.value);
        await app.setTheme(toTauriTheme.get(e.target.value));
    }

    useEffect(() => {
        const initTheme = async () => {
            const tauriTheme = await settingsStore.get<string>("theme");
            toTauriTheme.forEach((value, key) => {
                if (value === tauriTheme && key) {
                    setTheme(key);
                }
            })
        };
        initTheme();
    }, [])

    return (
        <Box display="flex">
            <Typography alignContent="center">Theme</Typography>
            <Select
                value={theme}
                onChange={handleThemeChanged}
                sx={{ margin: 1, minWidth: 160 }}
                size="small"
            >
                <MenuItem value="system">System Theme</MenuItem>
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
            </Select>
        </Box>
    );
}
