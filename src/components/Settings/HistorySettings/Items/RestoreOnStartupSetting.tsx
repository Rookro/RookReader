import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { settingsStore } from "../../../../settings/SettingsStore";
import { RestorePageOutlined } from "@mui/icons-material";

/**
 * Restore on startup setting component.
 */
export default function RestoreOnStartupSetting() {
  const { t } = useTranslation();
  const [restoreLastContainer, setRestoreLastContainer] = useState(false);

  // Initializes the setting from the settings store when the component mounts.
  useEffect(() => {
    const init = async () => {
      const restoreLastContainer =
        (await settingsStore.get<boolean>("restore-last-container-on-startup")) ?? true;
      setRestoreLastContainer(restoreLastContainer);
    };
    init();
  }, []);

  const handleRestoreFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setRestoreLastContainer(e.target.checked);
      await settingsStore.set("restore-last-container-on-startup", e.target.checked);
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
