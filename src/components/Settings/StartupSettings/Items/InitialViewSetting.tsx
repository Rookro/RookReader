import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { Language } from "@mui/icons-material";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * Initial view setting component.
 */
export default function InitialViewSetting() {
  const { t } = useTranslation();
  const initialView = useAppSelector((state) => state.settings["initial-view"]);
  const dispatch = useAppDispatch();

  const handleInitialViewChanged = useCallback(
    async (e: SelectChangeEvent) => {
      if (e.target.value === "reader" || e.target.value === "bookshelf") {
        dispatch(updateSettings({ key: "initial-view", value: e.target.value }));
      }
    },
    [dispatch],
  );

  return (
    <ListItem>
      <ListItemIcon>
        <Language />
      </ListItemIcon>
      <ListItemText primary={t("settings.startup.initial-view.title")} />
      <Select
        label={t("settings.startup.initial-view.title")}
        variant="standard"
        defaultValue={initialView}
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
