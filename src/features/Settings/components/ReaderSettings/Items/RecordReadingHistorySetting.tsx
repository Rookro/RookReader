import { HistoryOutlined } from "@mui/icons-material";
import { emit } from "@tauri-apps/api/event";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

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
    <SwitchSettingItem
      icon={<HistoryOutlined />}
      primaryText={t("settings.reader.history-feature.title")}
      secondaryText={t("settings.reader.history-feature.description")}
      defaultChecked={historySettings.recordReadingHistory}
      onChange={handleRecordReadingHistoryChanged}
    />
  );
}
