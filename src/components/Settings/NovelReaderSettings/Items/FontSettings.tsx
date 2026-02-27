import { FontDownloadOutlined, FormatSize } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../bindings/FontCommands";
import NumberSpinner from "../../../../components/NumberSpinner";
import { settingsStore } from "../../../../settings/SettingsStore";
import { NovelReaderSettings } from "../../../../types/Settings";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";

const defaultFont = "default-font";
const defaultFontSize = 16;

/**
 * Font settings component.
 */
export default function FontSettings() {
  const { t } = useTranslation();
  const [currentFont, setCurrentFont] = useState(defaultFont);
  const [currentFontSize, setCurrentFontSize] = useState(10);
  const [fonts, setFonts] = useState<string[]>([]);

  const handleFontChanged = async (e: SelectChangeEvent) => {
    debug(`Font changed: ${e.target.value}`);
    setCurrentFont(e.target.value);
    emit<SettingsChangedEvent>("settings-changed", { novelReader: { font: e.target.value } });
    const settings = await settingsStore.get<NovelReaderSettings>("novel-reader");
    settingsStore.set("novel-reader", { ...settings, font: e.target.value });
  };

  const handleFontSizeChanged = async (value: number | null) => {
    value = value ?? defaultFontSize;
    debug(`Font size changed: ${value}`);
    setCurrentFontSize(value);
    emit<SettingsChangedEvent>("settings-changed", { novelReader: { "font-size": value } });
    const settings = await settingsStore.get<NovelReaderSettings>("novel-reader");
    settingsStore.set("novel-reader", { ...settings, "font-size": value });
  };

  useEffect(() => {
    const initFonts = async () => {
      const novelReaderSettings = await settingsStore.get<NovelReaderSettings>("novel-reader");
      setCurrentFont(novelReaderSettings?.font ?? defaultFont);
      setCurrentFontSize(novelReaderSettings?.["font-size"] ?? defaultFontSize);

      const fonts = await getFonts();
      setFonts(fonts);
    };

    initFonts();
  }, []);

  return (
    <>
      <ListItem>
        <ListItemIcon>
          <FontDownloadOutlined />
        </ListItemIcon>
        <ListItemText primary={t("settings.novel-reader.font.title")} />
        <Select
          label={t("settings.novel-reader.font.title")}
          variant="standard"
          value={currentFont}
          onChange={handleFontChanged}
          size="small"
          autoWidth
        >
          <MenuItem value={defaultFont}>
            {t("settings.novel-reader.font.default-font-name")}
          </MenuItem>
          {fonts.map((font) => (
            <MenuItem key={font} value={font}>
              {font}
            </MenuItem>
          ))}
        </Select>
      </ListItem>
      <ListItem>
        <ListItemIcon>
          <FormatSize />
        </ListItemIcon>
        <ListItemText primary={t("settings.novel-reader.font-size.title")} />
        <NumberSpinner
          value={currentFontSize}
          min={0.5}
          max={100}
          size="small"
          onValueCommitted={handleFontSizeChanged}
        />
        <Typography variant="body2" sx={{ marginLeft: 1 }}>
          px
        </Typography>
      </ListItem>
    </>
  );
}
