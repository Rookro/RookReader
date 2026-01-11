import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import HomeDirSetting from "./Items/HomeDirSetting";
import DirWatchSetting from "./Items/DirWatchSetting";
import SettingsPanel from "../SettingsPanel";

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
        <DirWatchSetting />
      </List>
    </SettingsPanel>
  );
}
