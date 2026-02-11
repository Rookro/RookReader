import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import SettingsPanel from "../SettingsPanel";
import PdfRenderingSetting from "./Items/PdfRenderingSetting";
import MaxImageHeightSetting from "./Items/MaxImageHeightSetting";
import ImageResizeMethodSetting from "./Items/ImageResizeMethodSetting";

/**
 * Rendering settings component.
 */
export default function RenderingSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.rendering.title")}>
      <List>
        <MaxImageHeightSetting />
        <ImageResizeMethodSetting />
        <Divider />
        <PdfRenderingSetting />
      </List>
    </SettingsPanel>
  );
}
