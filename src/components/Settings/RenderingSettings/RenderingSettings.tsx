import { useTranslation } from "react-i18next";
import { List } from "@mui/material";
import PdfRenderingSetting from "./Items/PdfRenderingSetting";
import SettingsPanel from "../SettingsPanel";

/**
 * Rendering settings component.
 */
export default function RenderingSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.rendering.title")}>
      <List>
        <PdfRenderingSetting />
      </List>
    </SettingsPanel>
  );
}
