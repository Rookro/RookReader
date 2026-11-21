import MouseOutlined from "@mui/icons-material/MouseOutlined";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { type ClickToTurnPagesMode, clickToTurnPagesModes } from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";
import SelectSettingItem from "../../ui/SelectSettingItem";

const isMode = (value: unknown): value is ClickToTurnPagesMode =>
  clickToTurnPagesModes.includes(value as ClickToTurnPagesMode);

/**
 * Click to turn pages setting component.
 *
 * Controls whether a left-click anywhere in the reading area goes to the next page, or
 * turns towards the side of the page it lands on.
 */
export default function ClickToTurnPagesSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const handleChange = useCallback(
    async (e: SelectChangeEvent<unknown>) => {
      const value = e.target.value;
      if (!isMode(value)) {
        return;
      }
      debug(`"click to turn pages" setting changed to ${value}`);
      await dispatch(updateSettings({ key: "reader", value: { clickToTurnPages: value } }));
    },
    [dispatch],
  );

  return (
    <SelectSettingItem
      icon={<MouseOutlined />}
      primaryText={t("settings.reader.click-to-turn-pages.title")}
      secondaryText={t("settings.reader.click-to-turn-pages.description")}
      value={readerSettings.clickToTurnPages}
      onChange={handleChange}
    >
      <MenuItem value="anywhere">{t("settings.reader.click-to-turn-pages.anywhere")}</MenuItem>
      <MenuItem value="bySide">{t("settings.reader.click-to-turn-pages.bySide")}</MenuItem>
    </SelectSettingItem>
  );
}
