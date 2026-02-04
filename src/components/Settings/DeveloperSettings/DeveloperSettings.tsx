import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import LogSetting from "./Items/LogSetting";
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
        <LogSetting />
        <Divider />
        <ExperimentalFeatures />
      </List>
    </SettingsPanel>
  );
}
