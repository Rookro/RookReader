import { FontDownloadOutlined } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFonts } from "../../../../bindings/FontCommands";
import { settingsStore } from "../../../../settings/SettingsStore";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { useAppDispatch } from "../../../../Store";
import { setFontFamily } from "../../../../reducers/ViewReducer";

const defaultFont = "Inter, Avenir, Helvetica, Arial, sans-serif";

/**
 * Font family setting component.
 */
export default function FontFamilySetting() {
  const { t } = useTranslation();
  const [currentFont, setCurrentFont] = useState(defaultFont);
  const [fonts, setFonts] = useState<string[]>([]);
  const dispatch = useAppDispatch();

  const handleFontFamilyChanged = async (e: SelectChangeEvent) => {
    debug(`Font changed: ${e.target.value}`);
    setCurrentFont(e.target.value);
    emit<SettingsChangedEvent>("settings-changed", { fontFamily: e.target.value });
    settingsStore.set("font-family", e.target.value);
    dispatch(setFontFamily(e.target.value));
  };

  useEffect(() => {
    const initFonts = async () => {
      const fontFamily = await settingsStore.get<string>("font-family");
      setCurrentFont(fontFamily ?? defaultFont);

      const fonts = await getFonts();
      setFonts(fonts);
    };

    initFonts();
  }, []);

  return (
    <ListItem>
      <ListItemIcon>
        <FontDownloadOutlined />
      </ListItemIcon>
      <ListItemText primary={t("settings.general.font-family.title")} />
      <Select
        label={t("settings.general.font-family.title")}
        variant="standard"
        value={currentFont}
        onChange={handleFontFamilyChanged}
        size="small"
        autoWidth
      >
        <MenuItem value={defaultFont}>
          {t("settings.general.font-family.default-font-name")}
        </MenuItem>
        {fonts.map((font) => (
          <MenuItem key={font} value={font}>
            {font}
          </MenuItem>
        ))}
      </Select>
    </ListItem>
  );
}
