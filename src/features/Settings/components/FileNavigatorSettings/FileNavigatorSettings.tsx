import { Divider, List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import HomeDirSetting from "./Items/HomeDirSetting";
import WatchDirectoryChangesSetting from "./Items/WatchDirectoryChangesSetting";

/**
 * File navigator settings component.
 */
export default function FileNavigatorSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.file-navigator.title")}>
      <List>
        <HomeDirSetting />
        <Divider />
        <WatchDirectoryChangesSetting />
      </List>
    </SettingsPanel>
  );
}
