import { useEffect, useState } from "react";
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
import { settingsStore } from "../../../../settings/SettingsStore";

/**
 * Initial view setting component.
 */
export default function InitialViewSetting() {
  const { t } = useTranslation();
  const [initialView, setInitialView] = useState<"reader" | "bookshelf">("reader");

  // Initializes the setting from the settings store when the component mounts.
  useEffect(() => {
    const init = async () => {
      const initialView = await settingsStore.get<string>("initial-view");
      if (initialView === "reader" || initialView === "bookshelf") {
        setInitialView(initialView);
      }
    };
    init();
  }, []);

  const handleInitialViewChanged = async (e: SelectChangeEvent) => {
    if (e.target.value === "reader" || e.target.value === "bookshelf") {
      setInitialView(e.target.value);
      await settingsStore.set("initial-view", e.target.value);
    }
  };

  return (
    <ListItem>
      <ListItemIcon>
        <Language />
      </ListItemIcon>
      <ListItemText primary={t("settings.startup.initial-view.title")} />
      <Select
        label={t("settings.startup.initial-view.title")}
        variant="standard"
        value={initialView}
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
