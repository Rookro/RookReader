import { Divider, List, ListSubheader } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import AutoOpenAdjacentBookSetting from "./Items/AutoOpenAdjacentBookSetting";
import FontSettings from "./Items/FontSettings";
import LoupeSettingsItem from "./Items/LoupeSettingsItem";
import RecordReadingHistorySetting from "./Items/RecordReadingHistorySetting";
import ShowCoverAsSinglePageSetting from "./Items/ShowCoverAsSinglePageSetting";

/**
 * Reader settings component.
 */
export default function ReaderSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.reader.title")}>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.reader.headers.comic")}
        </ListSubheader>
        <ShowCoverAsSinglePageSetting />
        <Divider />
        <AutoOpenAdjacentBookSetting />
        <Divider />
        <LoupeSettingsItem />
      </List>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.reader.headers.novel")}
        </ListSubheader>
        <FontSettings />
      </List>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.reader.headers.history")}
        </ListSubheader>
        <RecordReadingHistorySetting />
      </List>
    </SettingsPanel>
  );
}
