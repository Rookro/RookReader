import { Divider, List } from "@mui/material";
import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import ImageCacheSizeSetting from "./Items/ImageCacheSizeSetting";
import LoupeSettingsItem from "./Items/LoupeSettingsItem";
import PreloadPageCountSetting from "./Items/PreloadPageCountSetting";
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
        <Divider />
        <PreloadPageCountSetting />
        <Divider />
        <ImageCacheSizeSetting />
      </List>
    </SettingsPanel>
  );
}
