import { FontDownloadOutlined } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setImageResizeMethod } from "../../../../bindings/ContainerCommands";
import { settingsStore } from "../../../../settings/SettingsStore";
import { ResizeMethod, resizeMethods } from "../../../../types/ResizeMethod";
import { RenderingSettings } from "../../../../types/Settings";

/**
 * Image resize setting component.
 */
export default function ImageResizeMethodSetting() {
  const { t } = useTranslation();
  const [currentMethod, setCurrentMethod] = useState<ResizeMethod>("triangle");

  const getResizeMethodLabel = useCallback(
    (method: string) => {
      switch (method) {
        case "nearest":
          return t("settings.rendering.resize.resize-method.nearest");
        case "triangle":
          return t("settings.rendering.resize.resize-method.triangle");
        case "catmullRom":
          return t("settings.rendering.resize.resize-method.catmullRom");
        case "gaussian":
          return t("settings.rendering.resize.resize-method.gaussian");
        case "lanczos3":
          return t("settings.rendering.resize.resize-method.lanczos3");
        default:
          return `Unknown ${method}`;
      }
    },
    [t],
  );

  const handleMethodChanged = useCallback(async (e: SelectChangeEvent) => {
    debug(`Image Resize Method changed: ${e.target.value}`);
    setCurrentMethod(e.target.value as ResizeMethod);

    try {
      setImageResizeMethod(e.target.value);
    } catch (e) {
      error(`Failed to set image resize method: ${e}`);
      return;
    }
    const settings = await settingsStore.get<RenderingSettings>("rendering");
    settingsStore.set("rendering", { ...settings, "image-resize-method": e.target.value });
  }, []);

  useEffect(() => {
    const initSettings = async () => {
      const resizeMethod =
        (await settingsStore.get<RenderingSettings>("rendering"))?.["image-resize-method"] ??
        "triangle";
      setCurrentMethod(resizeMethod);
    };

    initSettings();
  }, []);

  return (
    <ListItem>
      <ListItemIcon>
        <FontDownloadOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.rendering.resize.resize-method.title")}
        secondary={t("settings.rendering.resize.resize-method.description")}
        sx={{ marginRight: "10px" }}
      />
      <Select
        label={t("settings.rendering.resize.resize-method.title")}
        variant="standard"
        value={currentMethod}
        onChange={handleMethodChanged}
        size="small"
        autoWidth
      >
        {resizeMethods.map((method) => (
          <MenuItem key={method} value={method}>
            {getResizeMethodLabel(method)}
          </MenuItem>
        ))}
      </Select>
    </ListItem>
  );
}
