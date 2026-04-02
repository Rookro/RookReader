import { useTranslation } from "react-i18next";
import { List } from "@mui/material";
import ShowCoverAsSinglePageSetting from "./Items/ShowCoverAsSinglePageSetting";
import SettingsPanel from "../SettingsPanel";

/**
 * Page settings component.
 */
export default function PageSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.page.title")}>
      <List>
        <ShowCoverAsSinglePageSetting />
      </List>
    </SettingsPanel>
  );
}
