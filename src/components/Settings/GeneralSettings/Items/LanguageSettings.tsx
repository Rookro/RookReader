import { useState } from "react";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { Box, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";

/**
 * Language setting component.
 */
export default function LanguageSetting() {
    const [t, i18n] = useTranslation();
    const [language, setLanguage] = useState<string>(i18n.languages[0]);

    const handleLanguageChanged = async (e: SelectChangeEvent) => {
        setLanguage(e.target.value);
        i18n.changeLanguage(e.target.value).then(() => {
            // Emit an event to call changeLanguage() in the other WebView contexts as well,
            // since the language change is immediately reflected only within its own WebView context.
            emit('i18n-language-changed', { language: e.target.value });
            debug(`Language changed: ${e.target.value}`);
        });;
    }

    return (
        <Box display="flex">
            <Typography alignContent="center">{t('settings.general.language.title')}</Typography>
            <Select
                value={language}
                onChange={handleLanguageChanged}
                sx={{ margin: 1, minWidth: 160 }}
                size="small"
            >
                <MenuItem value="en-US">{t('settings.general.language.english')}</MenuItem>
                <MenuItem value="ja-JP">{t('settings.general.language.japanese')}</MenuItem>
            </Select>
        </Box>
    );
}
