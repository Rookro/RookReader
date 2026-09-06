import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReadingDirectionIcon from "../../../../../components/ui/ReadingDirectionIcon";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { type Direction, directions } from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";
import SelectSettingItem from "../../ui/SelectSettingItem";

const isDirection = (value: unknown): value is Direction => directions.includes(value as Direction);

/**
 * Default page direction setting component.
 *
 * Sets the direction a book opens with the first time it is read. Flipping the direction
 * in the reader is remembered against that book alone and does not come back here.
 */
export default function ReadingDirectionSetting() {
  const { t } = useTranslation();
  const direction = useAppSelector((state) => state.settings.reader.comic.readingDirection);
  const dispatch = useAppDispatch();

  const handleChange = useCallback(
    async (e: SelectChangeEvent<unknown>) => {
      const value = e.target.value;
      if (!isDirection(value)) {
        return;
      }
      debug(`"default reading direction" setting changed to ${value}`);
      await dispatch(
        updateSettings({ key: "reader", value: { comic: { readingDirection: value } } }),
      );
    },
    [dispatch],
  );

  return (
    <SelectSettingItem
      icon={<ReadingDirectionIcon direction={direction} />}
      primaryText={t("settings.reader.reading-direction.title")}
      secondaryText={t("settings.reader.reading-direction.description")}
      value={direction}
      onChange={handleChange}
    >
      <MenuItem value="rtl">{t("settings.reader.reading-direction.rtl")}</MenuItem>
      <MenuItem value="ltr">{t("settings.reader.reading-direction.ltr")}</MenuItem>
    </SelectSettingItem>
  );
}
