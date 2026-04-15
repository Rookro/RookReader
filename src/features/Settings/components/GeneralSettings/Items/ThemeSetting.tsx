import {
  DarkModeOutlined,
  LightModeOutlined,
  Palette,
  SettingsBrightnessOutlined,
} from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { app } from "@tauri-apps/api";
import type { Theme } from "@tauri-apps/api/window";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { AppTheme } from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";

/**
 * Mapping from theme names to Tauri's theme setting values.
 */
const toTauriTheme = new Map<AppTheme, Theme | undefined>([
  ["system", undefined],
  ["dark", "dark"],
  ["light", "light"],
]);

/**
 * Theme setting component.
 */
export default function ThemeSetting() {
  const { t } = useTranslation();
  const generalSettings = useAppSelector((state) => state.settings.general);
  const dispatch = useAppDispatch();

  const handleThemeChanged = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, newTheme: AppTheme) => {
      if (newTheme !== null) {
        const newGeneralSettings = { ...generalSettings, theme: newTheme };
        dispatch(updateSettings({ key: "general", value: newGeneralSettings }));
        await app.setTheme(toTauriTheme.get(newTheme));
      }
    },
    [generalSettings, dispatch],
  );

  return (
    <ListItem>
      <ListItemIcon>
        <Palette />
      </ListItemIcon>
      <ListItemText primary={t("settings.general.theme.title")} />
      <ToggleButtonGroup
        value={generalSettings.theme}
        exclusive
        onChange={handleThemeChanged}
        size="small"
      >
        <ToggleButton value="light" sx={{ textTransform: "none" }}>
          <LightModeOutlined sx={{ marginRight: "4px" }} />
          {t("settings.general.theme.light")}
        </ToggleButton>
        <ToggleButton value="system" sx={{ textTransform: "none" }}>
          <SettingsBrightnessOutlined sx={{ marginRight: "4px" }} />
          {t("settings.general.theme.system")}
        </ToggleButton>
        <ToggleButton value="dark" sx={{ textTransform: "none" }}>
          <DarkModeOutlined sx={{ marginRight: "4px" }} />
          {t("settings.general.theme.dark")}
        </ToggleButton>
      </ToggleButtonGroup>
    </ListItem>
  );
}
