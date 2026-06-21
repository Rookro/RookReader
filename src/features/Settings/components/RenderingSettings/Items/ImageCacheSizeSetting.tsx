import { StorageOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Image cache size setting component.
 */
export default function ImageCacheSizeSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const comicSettings = useAppSelector((state) => state.settings.reader.comic);

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const size = value ?? 1024;

      // Send only the changed leaf; updateSettings deep-merges it into the current
      // reader settings. Validation happens in the backend and is applied at runtime.
      await dispatch(
        updateSettings({ key: "reader", value: { comic: { cache: { imageCacheSizeMib: size } } } }),
      );
    },
    [dispatch],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<StorageOutlined />}
      primaryText={t("settings.rendering.cache.image-cache-size.title")}
      secondaryText={t("settings.rendering.cache.image-cache-size.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={comicSettings.cache.imageCacheSizeMib}
      // Bounds mirror the backend's garde validation for imageCacheSizeMib
      // (range(min = 1, max = 65536)); the spinner clamps to them so an
      // out-of-range value is never sent and then rejected.
      min={1}
      max={65536}
      onValueCommitted={handleCommitted}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
