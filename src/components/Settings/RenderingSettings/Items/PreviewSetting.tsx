import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Switch, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { AutoStoriesOutlined } from "@mui/icons-material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * Preview setting component.
 */
export default function PreviewSetting() {
  const { t } = useTranslation();
  const { rendering: renderingSettings } = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();

  const handleEnablePreviewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`Enable preview switch changed to ${e.target.checked}`);
      const newSettings = { ...renderingSettings, "enable-preview": e.target.checked };
      dispatch(updateSettings({ key: "rendering", value: newSettings }));

      await emit<SettingsChangedEvent>("settings-changed", {
        view: { enablePreview: e.target.checked },
      });
    },
    [dispatch, renderingSettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={renderingSettings["enable-preview"]}
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
