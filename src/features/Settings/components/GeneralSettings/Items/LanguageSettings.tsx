import { Language } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";

/**
 * Language setting component.
 */
export default function LanguageSetting() {
  const [t, i18n] = useTranslation();
  const [language, setLanguage] = useState<string>(i18n.resolvedLanguage ?? "en-US");

  const handleLanguageChanged = useCallback(
    async (e: SelectChangeEvent) => {
      setLanguage(e.target.value);
      i18n.changeLanguage(e.target.value).then(() => {
        emit<SettingsChangedEvent>("settings-changed", { locale: { language: e.target.value } });
        debug(`Language changed: ${e.target.value}`);
      });
    },
    [i18n],
  );

  return (
    <ListItem>
      <ListItemIcon>
        <Language />
      </ListItemIcon>
      <ListItemText primary={t("settings.general.language.title")} />
      <Select
        label={t("settings.general.language.title")}
        variant="standard"
        value={language}
        onChange={handleLanguageChanged}
        size="small"
        autoWidth
      >
        <MenuItem value="en-US">{t("settings.general.language.english")}</MenuItem>
        <MenuItem value="ja-JP">{t("settings.general.language.japanese")}</MenuItem>
      </Select>
    </ListItem>
  );
}
