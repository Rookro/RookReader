import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { AutoStoriesOutlined } from "@mui/icons-material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { RenderingSettings } from "../../../../types/Settings";

/**
 * Preview setting component.
 */
export default function PreviewSetting() {
  const { t } = useTranslation();
  const [enablePreview, setEnablePreview] = useState(false);

  useEffect(() => {
    const initSettings = async () => {
      const enablePreview =
        (await settingsStore.get<RenderingSettings>("rendering"))?.["enable-preview"] ?? true;
      setEnablePreview(enablePreview);
    };
    initSettings();
  }, []);

  const handleEnablePreviewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`Enable preview switch changed to ${e.target.checked}`);
      setEnablePreview(e.target.checked);
      const renderingSettings = await settingsStore.get<RenderingSettings>("rendering");
      await settingsStore.set("rendering", {
        ...renderingSettings,
        "enable-preview": e.target.checked,
      });

      await emit<SettingsChangedEvent>("settings-changed", {
        view: { enablePreview: e.target.checked },
      });
    },
    [],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch edge="end" checked={enablePreview} onChange={handleEnablePreviewSwitchChange} />
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
