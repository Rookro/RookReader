import { Cached } from "@mui/icons-material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Preload page count setting component.
 */
export default function PreloadPageCountSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const comicSettings = useAppSelector((state) => state.settings.reader.comic);
  const [isError] = useState(false);
  const [errorMsg] = useState("");

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const count = value ?? 10;
      await dispatch(
        updateSettings({ key: "reader", value: { comic: { cache: { preloadPageCount: count } } } }),
      );
    },
    [dispatch],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<Cached />}
      primaryText={t("settings.rendering.cache.preload-page-count.title")}
      secondaryText={t("settings.rendering.cache.preload-page-count.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={comicSettings.cache.preloadPageCount}
      min={0}
      step={1}
      error={isError}
      helperText={errorMsg}
      onValueCommitted={handleCommitted}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
