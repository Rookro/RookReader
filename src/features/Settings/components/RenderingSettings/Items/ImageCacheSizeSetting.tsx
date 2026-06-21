import { StorageOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Image cache size setting component.
 */
export default function ImageCacheSizeSetting() {
  const { t } = useTranslation();
  const imageCacheSizeMib = useAppSelector(
    (state) => state.settings.reader.comic.cache.imageCacheSizeMib,
  );
  const { error, helperText, commit } = useSettingsFieldError(
    "reader.comic.cache.imageCacheSizeMib",
    imageCacheSizeMib,
  );

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const size = value ?? 1024;

      // Send only the changed leaf; the backend validates and, on rejection, returns a
      // structured violation the hook surfaces inline below the field.
      await commit({ key: "reader", value: { comic: { cache: { imageCacheSizeMib: size } } } });
    },
    [commit],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<StorageOutlined />}
      primaryText={t("settings.rendering.cache.image-cache-size.title")}
      secondaryText={t("settings.rendering.cache.image-cache-size.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={imageCacheSizeMib}
      // Bounds mirror the backend garde validation (range(min = 1, max = 65536)). The step
      // buttons clamp to and disable at these bounds; a typed out-of-range value passes
      // through (allowOutOfRange) and is rejected by the backend with an inline message.
      min={1}
      max={65536}
      error={error}
      helperText={helperText}
      onValueCommitted={handleCommitted}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
