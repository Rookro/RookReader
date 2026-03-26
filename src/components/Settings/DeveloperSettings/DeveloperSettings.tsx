import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import LogLevelSetting from "./Items/LogLevelSetting";
import ExperimentalFeatures from "./Items/ExperimentalFeatures";
import SettingsPanel from "../SettingsPanel";

/**
 * Developer settings component.
 */
export default function DeveloperSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.developer.title")}>
      <List>
        <LogLevelSetting />
        <Divider />
        <ExperimentalFeatures />
      </List>
    </SettingsPanel>
  );
}
