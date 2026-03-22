import { useTranslation } from "react-i18next";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  DarkModeOutlined,
  LightModeOutlined,
  Palette,
  SettingsBrightnessOutlined,
} from "@mui/icons-material";
import { app } from "@tauri-apps/api";
import { Theme } from "@tauri-apps/api/window";
import { AppTheme } from "../../../../types/ThemeType";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

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
  const theme = useAppSelector((state) => state.settings.theme);
  const dispatch = useAppDispatch();

  const handleThemeChanged = async (_e: React.MouseEvent<HTMLElement>, newTheme: AppTheme) => {
    if (newTheme !== null) {
      dispatch(updateSettings({ key: "theme", value: newTheme }));
      await app.setTheme(toTauriTheme.get(newTheme));
    }
  };

  return (
    <ListItem>
      <ListItemIcon>
        <Palette />
      </ListItemIcon>
      <ListItemText primary={t("settings.general.theme.title")} />
      <ToggleButtonGroup value={theme} exclusive onChange={handleThemeChanged} size="small">
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
