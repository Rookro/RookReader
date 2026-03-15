import { useTranslation } from "react-i18next";
import { List } from "@mui/material";
import FeatureToggle from "./Items/FeatureToggle";
import SettingsPanel from "../SettingsPanel";

/**
 * History settings component.
 */
export default function HistorySettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.history.title")}>
      <List>
        <FeatureToggle />
      </List>
    </SettingsPanel>
  );
}
