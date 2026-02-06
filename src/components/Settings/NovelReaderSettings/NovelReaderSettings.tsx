import { useTranslation } from "react-i18next";
import { List } from "@mui/material";
import FontSettings from "./Items/FontSettings";
import SettingsPanel from "../SettingsPanel";

/**
 * Novel reader settings component.
 */
export default function NovelReaderSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.novel-reader.title")}>
      <List>
        <FontSettings />
      </List>
    </SettingsPanel>
  );
}
