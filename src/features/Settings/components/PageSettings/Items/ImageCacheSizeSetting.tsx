import { StorageOutlined } from "@mui/icons-material";
import { emit } from "@tauri-apps/api/event";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setImageCacheSizeMib } from "../../../../../bindings/ContainerCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
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

  // Re-fetch current reader settings to ensure we update correctly
  const readerSettings = useAppSelector((state) => state.settings.reader);

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const size = value ?? 1024;

      try {
        await setImageCacheSizeMib(size);
      } catch (e) {
        error(`Failed to set image cache size: ${e}`);
        setIsError(true);
        setErrorMsg(t("settings.page.cache.image-cache-size.error-message"));
        return;
      }

      setIsError(false);
      setErrorMsg("");

      const newComicSettings = {
        ...readerSettings.comic,
        cache: { ...readerSettings.comic.cache, imageCacheSizeMib: size },
      };
      const newReaderSettings = {
        ...readerSettings,
        comic: newComicSettings,
      };

      await dispatch(updateSettings({ key: "reader", value: newReaderSettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { reader: newReaderSettings },
      });
    },
    [t, dispatch, readerSettings],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<StorageOutlined />}
      primaryText={t("settings.page.cache.image-cache-size.title")}
      secondaryText={t("settings.page.cache.image-cache-size.description")}
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
