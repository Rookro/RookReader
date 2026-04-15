import { List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import FontSettings from "./Items/FontSettings";

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
