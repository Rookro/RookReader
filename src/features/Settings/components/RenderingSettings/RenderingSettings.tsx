import { Divider, List, ListSubheader } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import ImageCacheSizeSetting from "./Items/ImageCacheSizeSetting";
import ImageResamplingMethodSetting from "./Items/ImageResamplingMethodSetting";
import MaxImageHeightSetting from "./Items/MaxImageHeightSetting";
import PdfRenderResolutionHeightSetting from "./Items/PdfRenderResolutionHeightSetting";
import PreloadPageCountSetting from "./Items/PreloadPageCountSetting";
import ThumbnailPreviewSetting from "./Items/ThumbnailPreviewSetting";

/**
 * Rendering and performance settings component.
 */
export default function RenderingSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.rendering.title")}>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.rendering.headers.rendering")}
        </ListSubheader>
        <ThumbnailPreviewSetting />
        <Divider />
        <MaxImageHeightSetting />
        <ImageResamplingMethodSetting />
        <Divider />
        <PdfRenderResolutionHeightSetting />
      </List>
      <List>
        <ListSubheader disableSticky color="primary">
          {t("settings.rendering.headers.cache-and-preload")}
        </ListSubheader>
        <PreloadPageCountSetting />
        <Divider />
        <ImageCacheSizeSetting />
      </List>
    </SettingsPanel>
  );
}
