import { HistoryOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

/**
 * History feature toggle component.
 */
export default function RecordReadingHistorySetting() {
  const { t } = useTranslation();
  const historySettings = useAppSelector((state) => state.settings.history);
  const dispatch = useAppDispatch();

  const handleRecordReadingHistoryChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newHistorySettings = { ...historySettings, recordReadingHistory: e.target.checked };
      await dispatch(updateSettings({ key: "history", value: newHistorySettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { history: newHistorySettings },
      });
    },
    [dispatch, historySettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={historySettings.recordReadingHistory}
          onChange={handleRecordReadingHistoryChanged}
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
