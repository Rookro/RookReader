import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import SettingsPanel from "../SettingsPanel";
import PdfRenderResolutionHeightSetting from "./Items/PdfRenderResolutionHeightSetting";
import MaxImageHeightSetting from "./Items/MaxImageHeightSetting";
import ImageResamplingMethodSetting from "./Items/ImageResamplingMethodSetting";
import ThumbnailPreviewSetting from "./Items/ThumbnailPreviewSetting";

/**
 * Rendering settings component.
 */
export default function RenderingSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.rendering.title")}>
      <List>
        <ThumbnailPreviewSetting />
        <Divider />
        <MaxImageHeightSetting />
        <ImageResamplingMethodSetting />
        <Divider />
        <PdfRenderResolutionHeightSetting />
      </List>
    </SettingsPanel>
  );
}
