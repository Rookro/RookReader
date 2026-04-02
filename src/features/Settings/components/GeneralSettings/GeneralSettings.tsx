import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import SettingsPanel from "../SettingsPanel";
import ThemeSetting from "./Items/ThemeSetting";
import LanguageSetting from "./Items/LanguageSettings";
import AppFontFamilySetting from "./Items/AppFontFamilySetting";

/**
 * General settings component.
 */
export default function GeneralSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.general.title")}>
      <List>
        <LanguageSetting />
        <Divider />
        <AppFontFamilySetting />
        <Divider />
        <ThemeSetting />
      </List>
    </SettingsPanel>
  );
}
