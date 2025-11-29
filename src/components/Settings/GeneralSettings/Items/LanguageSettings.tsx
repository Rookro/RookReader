import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import { settingsStore } from "../../../../settings/SettingsStore";

/**
 * Language setting component.
 */
export default function LanguageSetting() {
    const [t, i18n] = useTranslation();
    const [language, setLanguage] = useState<string>(i18n.language);

    const handleLanguageChanged = async (e: SelectChangeEvent) => {
        setLanguage(e.target.value);
        settingsStore.set("language", e.target.value);
        i18n.changeLanguage(e.target.value === "default" ? undefined : e.target.value);
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
                <MenuItem value="en">{t('settings.general.language.english')}</MenuItem>
                <MenuItem value="ja">{t('settings.general.language.japanese')}</MenuItem>
            </Select>
        </Box>
    );
}
