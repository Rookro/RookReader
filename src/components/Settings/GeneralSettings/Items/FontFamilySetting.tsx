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
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

const defaultFont = "Inter, Avenir, Helvetica, Arial, sans-serif";

/**
 * Font family setting component.
 */
export default function FontFamilySetting() {
  const { t } = useTranslation();
  const { "font-family": fontFamily } = useAppSelector((state) => state.settings);
  const [fonts, setFonts] = useState<string[]>([]);
  const dispatch = useAppDispatch();

  const handleFontFamilyChanged = async (e: SelectChangeEvent) => {
    debug(`Font changed: ${e.target.value}`);
    emit<SettingsChangedEvent>("settings-changed", { fontFamily: e.target.value });
    dispatch(updateSettings({ key: "font-family", value: e.target.value }));
  };

  useEffect(() => {
    const initFonts = async () => {
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
        defaultValue={fontFamily}
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
