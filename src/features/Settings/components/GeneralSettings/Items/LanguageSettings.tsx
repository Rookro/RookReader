import { Language } from "@mui/icons-material";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocaleChangedEvent } from "../../../../../types/LocaleChangedEvent";
import SelectSettingItem from "../../ui/SelectSettingItem";

/**
 * Language setting component.
 */
export default function LanguageSetting() {
  const [t, i18n] = useTranslation();
  const [language, setLanguage] = useState<string>(i18n.resolvedLanguage ?? "en-US");

  const handleLanguageChanged = useCallback(
    async (e: SelectChangeEvent) => {
      setLanguage(e.target.value as string);
      i18n.changeLanguage(e.target.value as string).then(() => {
        emit<LocaleChangedEvent>("locale-changed", {
          language: e.target.value as string,
        });
        debug(`Language changed: ${e.target.value}`);
      });
    },
    [i18n],
  );

  return (
    <SelectSettingItem
      icon={<Language />}
      primaryText={t("settings.general.language.title")}
      value={language}
      onChange={handleLanguageChanged}
    >
      <MenuItem value="en-US">{t("settings.general.language.english")}</MenuItem>
      <MenuItem value="ja-JP">{t("settings.general.language.japanese")}</MenuItem>
    </SelectSettingItem>
  );
}
