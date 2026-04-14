import { AutoStoriesOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

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
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={readerSettings.rendering.enableThumbnailPreview}
          onChange={handleEnablePreviewSwitchChange}
        />
      }
    >
      <ListItemIcon>
        <AutoStoriesOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.rendering.preview.title")}
        secondary={t("settings.rendering.preview.description")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
