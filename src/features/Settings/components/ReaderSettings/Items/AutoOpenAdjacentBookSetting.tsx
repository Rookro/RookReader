import { MenuBook } from "@mui/icons-material";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import {
  type AutoOpenAdjacentBookMode,
  autoOpenAdjacentBookModes,
} from "../../../../../types/AppSettings";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";
import SelectSettingItem from "../../ui/SelectSettingItem";

const isMode = (value: unknown): value is AutoOpenAdjacentBookMode =>
  autoOpenAdjacentBookModes.includes(value as AutoOpenAdjacentBookMode);

/**
 * Auto-open adjacent book setting component.
 *
 * Controls whether the reader opens the next/previous book when the user pages past
 * the last/first page of the current book.
 */
export default function AutoOpenAdjacentBookSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const handleChange = useCallback(
    async (e: SelectChangeEvent<unknown>) => {
      const value = e.target.value;
      if (!isMode(value)) {
        return;
      }
      debug(`"auto-open adjacent book" setting changed to ${value}`);
      const newSettings = {
        ...readerSettings,
        autoOpenAdjacentBook: value,
      };
      await dispatch(updateSettings({ key: "reader", value: newSettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { reader: newSettings },
      });
    },
    [dispatch, readerSettings],
  );

  return (
    <SelectSettingItem
      icon={<MenuBook />}
      primaryText={t("settings.reader.auto-open-adjacent-book.title")}
      secondaryText={t("settings.reader.auto-open-adjacent-book.description")}
      value={readerSettings.autoOpenAdjacentBook}
      onChange={handleChange}
    >
      <MenuItem value="off">{t("settings.reader.auto-open-adjacent-book.off")}</MenuItem>
      <MenuItem value="ask">{t("settings.reader.auto-open-adjacent-book.ask")}</MenuItem>
      <MenuItem value="auto">{t("settings.reader.auto-open-adjacent-book.auto")}</MenuItem>
    </SelectSettingItem>
  );
}
