import CachedOutlined from "@mui/icons-material/CachedOutlined";
import { useTranslation } from "react-i18next";
import { useNumberSettingField } from "../../../hooks/useNumberSettingField";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Preload page count setting component.
 */
export default function PreloadPageCountSetting() {
  const { t } = useTranslation();
  const field = useNumberSettingField("reader.comic.cache.preloadPageCount");

  return (
    <NumberSpinnerSettingItem
      {...field}
      icon={<CachedOutlined />}
      primaryText={t("settings.rendering.cache.preload-page-count.title")}
      secondaryText={t("settings.rendering.cache.preload-page-count.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      step={1}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
