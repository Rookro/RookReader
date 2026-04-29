import { Divider, List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import LoupeSettingsItem from "./Items/LoupeSettingsItem";
import ShowCoverAsSinglePageSetting from "./Items/ShowCoverAsSinglePageSetting";

/**
 * Page settings component.
 */
export default function PageSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.page.title")}>
      <List>
        <ShowCoverAsSinglePageSetting />
        <Divider />
        <LoupeSettingsItem />
      </List>
    </SettingsPanel>
  );
}
