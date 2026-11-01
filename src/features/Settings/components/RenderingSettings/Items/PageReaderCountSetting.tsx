import MemoryOutlined from "@mui/icons-material/MemoryOutlined";
import { useTranslation } from "react-i18next";
import { useNumberSettingField } from "../../../hooks/useNumberSettingField";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Page reader thread count setting component.
 */
export default function PageReaderCountSetting() {
  const { t } = useTranslation();
  const field = useNumberSettingField("reader.comic.cache.pageReaderCount");

  return (
    <NumberSpinnerSettingItem
      {...field}
      icon={<MemoryOutlined />}
      primaryText={t("settings.rendering.cache.page-reader-count.title")}
      secondaryText={t("settings.rendering.cache.page-reader-count.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      step={1}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
