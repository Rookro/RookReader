import { StorageOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setImageCacheSizeMib } from "../../../../../bindings/ContainerCommands";
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
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const size = value ?? 1024;

      try {
        await setImageCacheSizeMib(size);
      } catch (e) {
        error(`Failed to set image cache size: ${e}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.cache.image-cache-size.error-message"));
        return;
      }

      setIsError(false);
      setErrorMsg("");

      await dispatch(
        updateSettings({ key: "reader", value: { comic: { cache: { imageCacheSizeMib: size } } } }),
      );
    },
    [t, dispatch],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<StorageOutlined />}
      primaryText={t("settings.rendering.cache.image-cache-size.title")}
      secondaryText={t("settings.rendering.cache.image-cache-size.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={comicSettings.cache.imageCacheSizeMib}
      min={128}
      error={isError}
      helperText={errorMsg}
      onValueCommitted={handleCommitted}
      inputSx={{ minWidth: "200px" }}
    />
  );
}
