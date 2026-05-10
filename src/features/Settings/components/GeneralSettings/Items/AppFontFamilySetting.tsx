import { FontDownloadOutlined } from "@mui/icons-material";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../../bindings/FontCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";
import SelectSettingItem from "../../ui/SelectSettingItem";

const defaultFont = "Inter, Avenir, Helvetica, Arial, sans-serif";

/**
 * Font family setting component.
 */
export default function AppFontFamilySetting() {
  const { t } = useTranslation();
  const generalSettings = useAppSelector((state) => state.settings.general);
  const [fonts, setFonts] = useState<string[]>([]);
  const dispatch = useAppDispatch();

  const handleFontFamilyChanged = useCallback(
    async (e: SelectChangeEvent) => {
      debug(`Application UI font family changed: ${e.target.value}`);
      const newGeneralSettings = { ...generalSettings, appFontFamily: e.target.value as string };
      await dispatch(updateSettings({ key: "general", value: newGeneralSettings }));
      emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { general: newGeneralSettings },
      });
    },
    [generalSettings, dispatch],
  );

  useEffect(() => {
    const initFonts = async () => {
      try {
        const fonts = await getFonts();
        setFonts(fonts);
      } catch (error) {
        // Fallback is implicitly handled by the empty 'fonts' state
        debug(`Failed to fetch fonts for settings: ${error}`);
      }
    };

    initFonts();
  }, []);

  return (
    <SelectSettingItem
      icon={<FontDownloadOutlined />}
      primaryText={t("settings.general.font-family.title")}
      defaultValue={generalSettings.appFontFamily}
      onChange={handleFontFamilyChanged}
    >
      <MenuItem value={defaultFont} sx={{ fontFamily: defaultFont }}>
        {t("settings.general.font-family.default-font-name")}
      </MenuItem>
      {fonts.map((font) => (
        <MenuItem key={font} value={font} sx={{ fontFamily: font }}>
          {font}
        </MenuItem>
      ))}
    </SelectSettingItem>
  );
}
