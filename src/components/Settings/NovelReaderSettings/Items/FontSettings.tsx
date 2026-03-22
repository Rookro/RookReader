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
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../bindings/FontCommands";
import NumberSpinner from "../../../../components/NumberSpinner";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../../reducers/SettingsReducer";
import { useAppDispatch, useAppSelector } from "../../../../Store";

const defaultFont = "default-font";
const defaultFontSize = 16;

/**
 * Font settings component.
 */
export default function FontSettings() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { "novel-reader": novelReaderSettings } = useAppSelector((state) => state.settings);
  const [fonts, setFonts] = useState<string[]>([]);

  const handleFontChanged = useCallback(
    async (e: SelectChangeEvent) => {
      debug(`Font changed: ${e.target.value}`);
      emit<SettingsChangedEvent>("settings-changed", { novelReader: { font: e.target.value } });
      const newSettings = { ...novelReaderSettings, font: e.target.value };
      dispatch(updateSettings({ key: "novel-reader", value: newSettings }));
    },
    [dispatch, novelReaderSettings],
  );

  const handleFontSizeChanged = useCallback(
    async (value: number | null) => {
      value = value ?? defaultFontSize;
      debug(`Font size changed: ${value}`);
      emit<SettingsChangedEvent>("settings-changed", { novelReader: { "font-size": value } });
      const newSettings = { ...novelReaderSettings, "font-size": value };
      dispatch(updateSettings({ key: "novel-reader", value: newSettings }));
    },
    [dispatch, novelReaderSettings],
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
      <ListItem>
        <ListItemIcon>
          <FontDownloadOutlined />
        </ListItemIcon>
        <ListItemText primary={t("settings.novel-reader.font.title")} />
        <Select
          label={t("settings.novel-reader.font.title")}
          variant="standard"
          defaultValue={novelReaderSettings.font ?? defaultFont}
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
          defaultValue={novelReaderSettings["font-size"] ?? defaultFontSize}
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
