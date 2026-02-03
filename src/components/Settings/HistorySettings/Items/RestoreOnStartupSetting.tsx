import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RestorePageOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { settingsStore } from "../../../../settings/SettingsStore";
import { HistorySettings } from "../../../../types/Settings";

/**
 * Restore on startup setting component.
 */
export default function RestoreOnStartupSetting() {
  const { t } = useTranslation();
  const [restoreLastContainer, setRestoreLastContainer] = useState(false);

  // Initializes the setting from the settings store when the component mounts.
  useEffect(() => {
    const init = async () => {
      const historySettings = await settingsStore.get<HistorySettings>("history");
      const restoreLastContainer = historySettings?.["restore-last-container-on-startup"] ?? true;
      setRestoreLastContainer(restoreLastContainer);
    };
    init();
  }, []);

  const handleRestoreFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setRestoreLastContainer(e.target.checked);
      const historySettings = (await settingsStore.get<HistorySettings>("history")) ?? {
        "restore-last-container-on-startup": true,
      };
      historySettings["restore-last-container-on-startup"] = e.target.checked;
      await settingsStore.set("history", historySettings);
    },
    [],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          checked={restoreLastContainer}
          onChange={handleRestoreFeatureToggleChanged}
        />
      }
    >
      <ListItemIcon>
        <RestorePageOutlined />
      </ListItemIcon>
      <ListItemText primary={t("settings.history.restore-toggle.title")} sx={{ marginRight: 3 }} />
    </ListItem>
  );
}
