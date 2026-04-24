import { RocketLaunch } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { InitialView } from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";

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
        const newSettings = { ...startupSettings, initialView: e.target.value as InitialView };
        dispatch(updateSettings({ key: "startup", value: newSettings }));
      }
    },
    [dispatch, startupSettings],
  );

  return (
    <ListItem>
      <ListItemIcon>
        <RocketLaunch />
      </ListItemIcon>
      <ListItemText primary={t("settings.startup.initial-view.title")} />
      <Select
        label={t("settings.startup.initial-view.title")}
        variant="standard"
        defaultValue={startupSettings.initialView}
        onChange={handleInitialViewChanged}
        size="small"
        autoWidth
      >
        <MenuItem value="reader">{t("settings.startup.initial-view.reader")}</MenuItem>
        <MenuItem value="bookshelf">{t("settings.startup.initial-view.bookshelf")}</MenuItem>
      </Select>
    </ListItem>
  );
}
