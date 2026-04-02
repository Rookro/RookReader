import { PublishedWithChangesOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

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
      const newFileNavigatorSettings = {
        ...fileNavigatorSettings,
        watchDirectoryChanges: e.target.checked,
      };
      dispatch(updateSettings({ key: "fileNavigator", value: newFileNavigatorSettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { fileNavigator: newFileNavigatorSettings },
      });
    },
    [dispatch, fileNavigatorSettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={fileNavigatorSettings.watchDirectoryChanges}
          onChange={handleIsWatchEnabledChange}
        />
      }
    >
      <ListItemIcon>
        <PublishedWithChangesOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.file-navigator.dir-watch.title")}
        secondary={t("settings.file-navigator.dir-watch.warn-message")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
