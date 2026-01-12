import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setIsHistoryEnabled } from "../../../../reducers/HistoryReducer";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { HistoryOutlined } from "@mui/icons-material";

/**
 * History feature toggle component.
 */
export default function FeatureToggle() {
  const { t } = useTranslation();
  const { isHistoryEnabled } = useAppSelector((state) => state.history);
  const dispatch = useAppDispatch();

  // Initializes the history settings from the settings store when the component mounts.
  useEffect(() => {
    const init = async () => {
      const isHistoryEnabled = (await settingsStore.get<boolean>("enable-history")) ?? true;
      dispatch(setIsHistoryEnabled(isHistoryEnabled));
    };
    init();
  }, [dispatch]);

  const handleHistoryFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setIsHistoryEnabled(e.target.checked));
      await settingsStore.set("enable-history", e.target.checked);
      await emit<SettingsChangedEvent>("settings-changed", {
        history: { isEnabled: e.target.checked },
      });
    },
    [dispatch],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          checked={isHistoryEnabled}
          onChange={handleHistoryFeatureToggleChanged}
        />
      }
    >
      <ListItemIcon>
        <HistoryOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.history.feature-toggle.title")}
        secondary={t("settings.history.feature-toggle.warn-message")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
