import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HistoryOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { setIsHistoryEnabled } from "../../../../reducers/HistoryReducer";
import { settingsStore } from "../../../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { HistorySettings } from "../../../../types/Settings";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";

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
      const historySettings = await settingsStore.get<HistorySettings>("history");
      const isHistoryEnabled = historySettings?.enable ?? true;
      dispatch(setIsHistoryEnabled(isHistoryEnabled));
    };
    init();
  }, [dispatch]);

  const handleHistoryFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setIsHistoryEnabled(e.target.checked));
      const historySettings = (await settingsStore.get<HistorySettings>("history")) ?? {
        enable: true,
      };
      historySettings.enable = e.target.checked;
      await settingsStore.set("history", historySettings);
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
