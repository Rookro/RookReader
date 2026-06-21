import { PublishedWithChangesOutlined } from "@mui/icons-material";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * Directory watch setting component.
 */
export default function WatchDirectoryChangesSetting() {
  const { t } = useTranslation();
  const fileNavigatorSettings = useAppSelector((state) => state.settings.fileNavigator);
  const dispatch = useAppDispatch();

  const handleIsWatchEnabledChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`Watch directory changes to ${e.target.checked}`);
      await dispatch(
        updateSettings({
          key: "fileNavigator",
          value: { watchDirectoryChanges: e.target.checked },
        }),
      );
    },
    [dispatch],
  );

  return (
    <SwitchSettingItem
      icon={<PublishedWithChangesOutlined />}
      primaryText={t("settings.file-navigator.dir-watch.title")}
      secondaryText={t("settings.file-navigator.dir-watch.warn-message")}
      defaultChecked={fileNavigatorSettings.watchDirectoryChanges}
      onChange={handleIsWatchEnabledChange}
    />
  );
}
