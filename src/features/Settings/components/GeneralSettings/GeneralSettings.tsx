import { Divider, List, ListSubheader } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import AppFontFamilySetting from "./Items/AppFontFamilySetting";
import CheckUpdateOnStartupSetting from "./Items/CheckUpdateOnStartupSetting";
import InitialViewSetting from "./Items/InitialViewSetting";
import LanguageSetting from "./Items/LanguageSettings";
import RestoreLastBookSetting from "./Items/RestoreLastBookSetting";
import ThemeSetting from "./Items/ThemeSetting";

/**
 * General settings component.
 */
export default function GeneralSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.general.title")}>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.general.headers.display-and-language")}
        </ListSubheader>
        <LanguageSetting />
        <Divider />
        <AppFontFamilySetting />
        <Divider />
        <ThemeSetting />
      </List>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.general.headers.startup-behavior")}
        </ListSubheader>
        <InitialViewSetting />
        <Divider />
        <RestoreLastBookSetting />
        <Divider />
        <CheckUpdateOnStartupSetting />
      </List>
    </SettingsPanel>
  );
}
