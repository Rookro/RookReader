import { FontDownloadOutlined } from "@mui/icons-material";
import { Box } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../../bindings/FontCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import AutocompleteSettingItem from "../../ui/AutocompleteSettingItem";

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
    async (value: string) => {
      debug(`Application UI font family changed: ${value}`);
      await dispatch(updateSettings({ key: "general", value: { appFontFamily: value } }));
    },
    [dispatch],
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

  const fontOptions = useMemo(() => {
    const options = [
      { label: t("settings.general.font-family.default-font-name"), value: defaultFont },
      ...fonts.map((font) => ({ label: font, value: font })),
    ];

    const currentValue = generalSettings.appFontFamily;
    if (currentValue && !options.some((opt) => opt.value === currentValue)) {
      options.push({ label: currentValue, value: currentValue });
    }

    return options;
  }, [fonts, t, generalSettings.appFontFamily]);

  return (
    <AutocompleteSettingItem
      icon={<FontDownloadOutlined />}
      primaryText={t("settings.general.font-family.title")}
      options={fontOptions}
      value={generalSettings.appFontFamily}
      onChange={handleFontFamilyChanged}
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ fontFamily: option.value }}>
          {option.label}
        </Box>
      )}
      noOptionsText={t("settings.ui.autocomplete.no-options")}
    />
  );
}
