import { FontDownloadOutlined, FormatSize } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Typography,
} from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../../bindings/FontCommands";
import NumberSpinner from "../../../../../components/ui/NumberSpinner";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

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
        novel: { ...readerSettings.novel, fontFamily: e.target.value },
      };
      dispatch(updateSettings({ key: "reader", value: newSettings }));
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
      dispatch(updateSettings({ key: "reader", value: newSettings }));
      emit<SettingsChangedEvent>("settings-changed", { appSettings: { reader: newSettings } });
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
      <ListItem>
        <ListItemIcon>
          <FontDownloadOutlined />
        </ListItemIcon>
        <ListItemText primary={t("settings.novel-reader.font.title")} />
        <Select
          label={t("settings.novel-reader.font.title")}
          variant="standard"
          defaultValue={readerSettings.novel.fontFamily}
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
          defaultValue={readerSettings.novel.fontSize}
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
