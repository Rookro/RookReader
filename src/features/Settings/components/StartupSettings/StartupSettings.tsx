import { Divider, List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import CheckUpdateOnStartupSetting from "./Items/CheckUpdateOnStartupSetting";
import InitialViewSetting from "./Items/InitialViewSetting";
import RestoreLastBookSetting from "./Items/RestoreLastBookSetting";

/**
 * Startup settings component.
 */
export default function StartupSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.startup.title")}>
      <List>
        <InitialViewSetting />
        <Divider />
        <RestoreLastBookSetting />
        <Divider />
        <CheckUpdateOnStartupSetting />
      </List>
    </SettingsPanel>
  );
}
