import { Divider, List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import AppFontFamilySetting from "./Items/AppFontFamilySetting";
import LanguageSetting from "./Items/LanguageSettings";
import ThemeSetting from "./Items/ThemeSetting";

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
