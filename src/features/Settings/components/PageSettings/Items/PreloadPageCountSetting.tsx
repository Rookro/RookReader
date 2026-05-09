import { Cached } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import NumberSpinner from "../../../../../components/ui/NumberSpinner";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

/**
 * Preload page count setting component.
 */
export default function PreloadPageCountSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const comicSettings = useAppSelector((state) => state.settings.reader.comic);
  const [isError] = useState(false);
  const [errorMsg] = useState("");

  // Re-fetch current reader settings to ensure we update correctly
  const readerSettings = useAppSelector((state) => state.settings.reader);

  const handleCommitted = useCallback(
    async (value: number | null) => {
      const count = value ?? 10;

      const newComicSettings = {
        ...readerSettings.comic,
        cache: { ...readerSettings.comic.cache, preloadPageCount: count },
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
    [dispatch, readerSettings],
  );

  return (
    <ListItem>
      <ListItemIcon>
        <Cached />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.page.cache.preload-page-count.title")}
        secondary={t("settings.page.cache.preload-page-count.description")}
        sx={{ marginRight: "10px" }}
        slotProps={{ secondary: { sx: { whiteSpace: "pre-wrap" } } }}
      />
      <NumberSpinner
        defaultValue={comicSettings.cache.preloadPageCount}
        min={0}
        step={1}
        size="small"
        error={isError}
        helperText={errorMsg}
        onValueCommitted={handleCommitted}
        sx={{ minWidth: "200px" }}
      />
    </ListItem>
  );
}
