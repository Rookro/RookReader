import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HistoryOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { settingsStore } from "../../../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { HistorySettings } from "../../../../types/Settings";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { setEnableHistory } from "../../../../reducers/ViewReducer";

/**
 * History feature toggle component.
 */
export default function FeatureToggle() {
  const { t } = useTranslation();
  const { enableHistory } = useAppSelector((state) => state.view);
  const dispatch = useAppDispatch();

  // Initializes the history settings from the settings store when the component mounts.
  useEffect(() => {
    const init = async () => {
      const historySettings = await settingsStore.get<HistorySettings>("history");
      const isHistoryEnabled = historySettings?.enable ?? true;
      dispatch(setEnableHistory(isHistoryEnabled));
    };
    init();
  }, [dispatch]);

  const handleHistoryFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setEnableHistory(e.target.checked));
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
        <Switch edge="end" checked={enableHistory} onChange={handleHistoryFeatureToggleChanged} />
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
