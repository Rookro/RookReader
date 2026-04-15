import { List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import RecordReadingHistorySetting from "./Items/RecordReadingHistorySetting";

/**
 * History settings component.
 */
export default function HistorySettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.history.title")}>
      <List>
        <RecordReadingHistorySetting />
      </List>
    </SettingsPanel>
  );
}
