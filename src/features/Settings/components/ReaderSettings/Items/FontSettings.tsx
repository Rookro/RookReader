import { FontDownloadOutlined, FormatSize } from "@mui/icons-material";
import { Box } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../../bindings/FontCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";
import AutocompleteSettingItem from "../../ui/AutocompleteSettingItem";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

const defaultFont = "default-font";

/**
 * Font settings component.
 */
export default function FontSettings() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const [fonts, setFonts] = useState<string[]>([]);

  const handleFontChanged = useCallback(
    async (value: string) => {
      debug(`Font family of novel reader changed: ${value}`);
      const newSettings = {
        ...readerSettings,
        novel: { ...readerSettings.novel, fontFamily: value },
      };
      await dispatch(updateSettings({ key: "reader", value: newSettings }));
      emit<SettingsChangedEvent>("settings-changed", { appSettings: { reader: newSettings } });
    },
    [dispatch, readerSettings],
  );

  const handleFontSizeChanged = useCallback(
    async (value: number | null) => {
      value = value ?? 0;
      debug(`Font size of novel reader changed: ${value}`);
      const newSettings = {
        ...readerSettings,
        novel: { ...readerSettings.novel, fontSize: value },
      };
      await dispatch(updateSettings({ key: "reader", value: newSettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { reader: newSettings },
      });
    },
    [dispatch, readerSettings],
  );

  useEffect(() => {
    const initFonts = async () => {
      const fonts = await getFonts();
      setFonts(fonts);
    };
    initFonts();
  }, []);

  const fontOptions = useMemo(() => {
    const options = [
      { label: t("settings.reader.font.default-font-name"), value: defaultFont },
      ...fonts.map((font) => ({ label: font, value: font })),
    ];

    const currentValue = readerSettings.novel.fontFamily;
    if (currentValue && !options.some((opt) => opt.value === currentValue)) {
      options.push({ label: currentValue, value: currentValue });
    }

    return options;
  }, [fonts, t, readerSettings.novel.fontFamily]);

  return (
    <>
      <AutocompleteSettingItem
        icon={<FontDownloadOutlined />}
        primaryText={t("settings.reader.font.title")}
        options={fontOptions}
        value={readerSettings.novel.fontFamily}
        onChange={handleFontChanged}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ fontFamily: option.value }}>
            {option.label}
          </Box>
        )}
        noOptionsText={t("settings.ui.autocomplete.no-options")}
      />
      <NumberSpinnerSettingItem
        icon={<FormatSize />}
        primaryText={t("settings.reader.font-size.title")}
        defaultValue={readerSettings.novel.fontSize}
        min={0.5}
        max={100}
        onValueCommitted={handleFontSizeChanged}
        unit="px"
      />
    </>
  );
}
