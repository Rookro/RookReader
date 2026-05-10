import { AutoStoriesOutlined } from "@mui/icons-material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * Preview setting component.
 */
export default function ThumbnailPreviewSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const handleEnablePreviewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`Enable preview switch changed to ${e.target.checked}`);
      const newSettings = {
        ...readerSettings,
        rendering: { ...readerSettings.rendering, enableThumbnailPreview: e.target.checked },
      };
      await dispatch(updateSettings({ key: "reader", value: newSettings }));

      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { reader: newSettings },
      });
    },
    [dispatch, readerSettings],
  );

  return (
    <SwitchSettingItem
      icon={<AutoStoriesOutlined />}
      primaryText={t("settings.rendering.preview.title")}
      secondaryText={t("settings.rendering.preview.description")}
      defaultChecked={readerSettings.rendering.enableThumbnailPreview}
      onChange={handleEnablePreviewSwitchChange}
    />
  );
}
