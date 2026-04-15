import { Divider, List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import ExperimentalFeatures from "./Items/ExperimentalFeatures";
import LogLevelSetting from "./Items/LogLevelSetting";

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
