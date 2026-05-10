import { FontDownloadOutlined, FormatSize } from "@mui/icons-material";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../../bindings/FontCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";
import SelectSettingItem from "../../ui/SelectSettingItem";

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
    async (e: SelectChangeEvent) => {
      debug(`Font family of novel reader changed: ${e.target.value}`);
      const newSettings = {
        ...readerSettings,
        novel: { ...readerSettings.novel, fontFamily: e.target.value as string },
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

  return (
    <>
      <SelectSettingItem
        icon={<FontDownloadOutlined />}
        primaryText={t("settings.reader.font.title")}
        defaultValue={readerSettings.novel.fontFamily}
        onChange={handleFontChanged}
      >
        <MenuItem value={defaultFont} sx={{ fontFamily: defaultFont }}>
          {t("settings.reader.font.default-font-name")}
        </MenuItem>
        {fonts.map((font) => (
          <MenuItem key={font} value={font} sx={{ fontFamily: font }}>
            {font}
          </MenuItem>
        ))}
      </SelectSettingItem>
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
