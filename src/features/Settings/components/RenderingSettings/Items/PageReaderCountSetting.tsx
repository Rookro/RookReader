import MemoryOutlined from "@mui/icons-material/MemoryOutlined";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import { SETTINGS_BOUNDS } from "../../../settingsBounds";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

const bounds = SETTINGS_BOUNDS["reader.comic.cache.pageReaderCount"];

/**
 * Page reader thread count setting component.
 */
export default function PageReaderCountSetting() {
  const { t } = useTranslation();
  const pageReaderCount = useAppSelector(
    (state) => state.settings.reader.comic.cache.pageReaderCount,
  );
  const { error, helperText, commit } = useSettingsFieldError(
    "reader.comic.cache.pageReaderCount",
    pageReaderCount,
  );

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const count = value ?? 0;
      await commit({ key: "reader", value: { comic: { cache: { pageReaderCount: count } } } });
    },
    [commit],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<MemoryOutlined />}
      primaryText={t("settings.rendering.cache.page-reader-count.title")}
      secondaryText={t("settings.rendering.cache.page-reader-count.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={pageReaderCount}
      min={bounds.min}
      max={bounds.max}
      step={1}
      error={error}
      helperText={helperText}
      onValueCommitted={handleCommitted}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
