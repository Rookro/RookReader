import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import { app } from "@tauri-apps/api"
import { Theme } from "@tauri-apps/api/window";
import { settingsStore } from "../../../../settings/SettingsStore";

/** 
 * Mapping from theme names to Tauri's theme setting values.
 */
const toTauriTheme = new Map<string, Theme | undefined>([
    ["system", undefined],
    ["dark", "dark"],
    ["light", "light"],
]);

/**
 * Theme setting component.
 */
export default function ThemeSetting() {
    const { t } = useTranslation();
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
            <Typography alignContent="center">{t('settings.general.theme.title')}</Typography>
            <Select
                value={theme}
                onChange={handleThemeChanged}
                sx={{ margin: 1, minWidth: 160 }}
                size="small"
            >
                <MenuItem value="system">{t('settings.general.theme.system')}</MenuItem>
                <MenuItem value="light">{t('settings.general.theme.light')}</MenuItem>
                <MenuItem value="dark">{t('settings.general.theme.dark')}</MenuItem>
            </Select>
        </Box>
    );
}
