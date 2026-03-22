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
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { setImageResizeMethod } from "../../../../bindings/ContainerCommands";
import { ResizeMethod, resizeMethods } from "../../../../types/ResizeMethod";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * Image resize setting component.
 */
export default function ImageResizeMethodSetting() {
  const { t } = useTranslation();
  const { rendering: renderingSettings } = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();

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

  const handleMethodChanged = useCallback(
    async (e: SelectChangeEvent) => {
      debug(`Image Resize Method changed: ${e.target.value}`);
      try {
        setImageResizeMethod(e.target.value);
      } catch (e) {
        error(`Failed to set image resize method: ${e}`);
        return;
      }
      const newSettings = {
        ...renderingSettings,
        "image-resize-method": e.target.value as ResizeMethod,
      };
      dispatch(updateSettings({ key: "rendering", value: newSettings }));
    },
    [dispatch, renderingSettings],
  );

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
        value={renderingSettings["image-resize-method"]}
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
