import { HistoryOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
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
      await dispatch(
        updateSettings({ key: "history", value: { recordReadingHistory: e.target.checked } }),
      );
    },
    [dispatch],
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
