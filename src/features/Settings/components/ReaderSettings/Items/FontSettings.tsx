import { FontDownloadOutlined, FormatSize } from "@mui/icons-material";
import { Box } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../../bindings/FontCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
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
  const {
    error: fontSizeError,
    helperText: fontSizeHelperText,
    commit: commitFontSize,
  } = useSettingsFieldError("reader.novel.fontSize", readerSettings.novel.fontSize);

  const handleFontChanged = useCallback(
    async (value: string) => {
      debug(`Font family of novel reader changed: ${value}`);
      await dispatch(updateSettings({ key: "reader", value: { novel: { fontFamily: value } } }));
    },
    [dispatch],
  );

  const handleFontSizeChanged = useCallback(
    async (value: number | null) => {
      const fontSize = value ?? 16;
      debug(`Font size of novel reader changed: ${fontSize}`);
      await commitFontSize({ key: "reader", value: { novel: { fontSize } } });
    },
    [commitFontSize],
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
        min={1}
        max={200}
        step={0.5}
        error={fontSizeError}
        helperText={fontSizeHelperText}
        onValueCommitted={handleFontSizeChanged}
        inputSx={{ minWidth: "200px" }}
        unit="px"
      />
    </>
  );
}
