import { List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import EnableAutoScrollSetting from "./Items/EnableAutoScrollSetting";

/**
 * Bookshelf settings component.
 */
export default function BookshelfSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.bookshelf.title")}>
      <List>
        <EnableAutoScrollSetting />
      </List>
    </SettingsPanel>
  );
}
