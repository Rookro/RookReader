import StorageOutlined from "@mui/icons-material/StorageOutlined";
import { useTranslation } from "react-i18next";
import { useNumberSettingField } from "../../../hooks/useNumberSettingField";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Image cache size setting component.
 */
export default function ImageCacheSizeSetting() {
  const { t } = useTranslation();
  const field = useNumberSettingField("reader.comic.cache.imageCacheSizeMib");

  return (
    <NumberSpinnerSettingItem
      {...field}
      icon={<StorageOutlined />}
      primaryText={t("settings.rendering.cache.image-cache-size.title")}
      secondaryText={t("settings.rendering.cache.image-cache-size.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
