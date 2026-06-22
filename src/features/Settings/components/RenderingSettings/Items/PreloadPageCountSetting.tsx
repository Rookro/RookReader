import { Cached } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Preload page count setting component.
 */
export default function PreloadPageCountSetting() {
  const { t } = useTranslation();
  const preloadPageCount = useAppSelector(
    (state) => state.settings.reader.comic.cache.preloadPageCount,
  );
  const { error, helperText, commit } = useSettingsFieldError(
    "reader.comic.cache.preloadPageCount",
    preloadPageCount,
  );

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const count = value ?? 10;
      await commit({ key: "reader", value: { comic: { cache: { preloadPageCount: count } } } });
    },
    [commit],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<Cached />}
      primaryText={t("settings.rendering.cache.preload-page-count.title")}
      secondaryText={t("settings.rendering.cache.preload-page-count.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={preloadPageCount}
      min={0}
      max={10000}
      step={1}
      error={error}
      helperText={helperText}
      onValueCommitted={handleCommitted}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
