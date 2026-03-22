import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HistoryOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { setEnableHistory } from "../../../../reducers/ViewReducer";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * History feature toggle component.
 */
export default function FeatureToggle() {
  const { t } = useTranslation();
  const { history: historySettings } = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();

  const handleHistoryFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setEnableHistory(e.target.checked));
      const newHistorySettings = { ...historySettings };
      newHistorySettings.enable = e.target.checked;
      dispatch(updateSettings({ key: "history", value: newHistorySettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        history: { isEnabled: e.target.checked },
      });
    },
    [dispatch, historySettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={historySettings.enable}
          onChange={handleHistoryFeatureToggleChanged}
        />
      }
    >
      <ListItemIcon>
        <HistoryOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.history.feature-toggle.title")}
        secondary={t("settings.history.feature-toggle.description")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
