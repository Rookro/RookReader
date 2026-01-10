import { useState } from "react";
import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { ListItem, ListItemIcon, ListItemText, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { Language } from "@mui/icons-material";

/**
 * Language setting component.
 */
export default function LanguageSetting() {
    const [t, i18n] = useTranslation();
    const [language, setLanguage] = useState<string>(i18n.languages[0]);

    const handleLanguageChanged = async (e: SelectChangeEvent) => {
        setLanguage(e.target.value);
        i18n.changeLanguage(e.target.value).then(() => {
            emit<SettingsChangedEvent>("settings-changed", { locale: { language: e.target.value } });
            debug(`Language changed: ${e.target.value}`);
        });;
    }

    return (
        <ListItem>
            <ListItemIcon><Language /></ListItemIcon>
            <ListItemText primary={t('settings.general.language.title')} />
            <Select
                label={t('settings.general.language.title')}
                variant="standard"
                value={language}
                onChange={handleLanguageChanged}
                sx={{ margin: 1, minWidth: 100 }}
                size="small"
            >
                <MenuItem value="en-US">{t('settings.general.language.english')}</MenuItem>
                <MenuItem value="ja-JP">{t('settings.general.language.japanese')}</MenuItem>
            </Select>
        </ListItem>
    );
}
