import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import FeatureToggle from "./Items/FeatureToggle";
import SettingsPanel from "../SettingsPanel";
import RestoreOnStartupSetting from "./Items/RestoreOnStartupSetting";

/**
 * History settings component.
 */
export default function HistorySettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.history.title")}>
      <List>
        <FeatureToggle />
        <Divider />
        <RestoreOnStartupSetting />
      </List>
    </SettingsPanel>
  );
}
