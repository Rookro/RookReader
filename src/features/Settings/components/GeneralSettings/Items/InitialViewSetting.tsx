import { RocketLaunch } from "@mui/icons-material";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { InitialView } from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";
import SelectSettingItem from "../../ui/SelectSettingItem";

/**
 * Initial view setting component.
 */
export default function InitialViewSetting() {
  const { t } = useTranslation();
  const startupSettings = useAppSelector((state) => state.settings.startup);
  const dispatch = useAppDispatch();

  const handleInitialViewChanged = useCallback(
    async (e: SelectChangeEvent) => {
      if (e.target.value === "reader" || e.target.value === "bookshelf") {
        dispatch(
          updateSettings({
            key: "startup",
            value: { initialView: e.target.value as InitialView },
          }),
        );
      }
    },
    [dispatch],
  );

  return (
    <SelectSettingItem
      icon={<RocketLaunch />}
      primaryText={t("settings.general.initial-view.title")}
      value={startupSettings.initialView}
      onChange={handleInitialViewChanged}
    >
      <MenuItem value="reader">{t("settings.general.initial-view.reader")}</MenuItem>
      <MenuItem value="bookshelf">{t("settings.general.initial-view.bookshelf")}</MenuItem>
    </SelectSettingItem>
  );
}
