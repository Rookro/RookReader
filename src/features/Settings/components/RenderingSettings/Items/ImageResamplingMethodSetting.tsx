import { FontDownloadOutlined } from "@mui/icons-material";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { setImageResamplingMethod } from "../../../../../bindings/ContainerCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import {
  type ImageResamplingMethod,
  imageResamplingMethods,
} from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";

/**
 * Image resize setting component.
 */
export default function ImageResamplingMethodSetting() {
  const { t } = useTranslation();
  const { reader: readerSettings } = useAppSelector((state) => state.settings);
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
      debug(`Image Resampling Method changed: ${e.target.value}`);
      try {
        setImageResamplingMethod(e.target.value);
      } catch (e) {
        error(`Failed to set image resampling method: ${e}`);
        return;
      }
      const newSettings = {
        ...readerSettings,
        rendering: {
          ...readerSettings.rendering,
          imageResamplingMethod: e.target.value as ImageResamplingMethod,
        },
      };
      dispatch(updateSettings({ key: "reader", value: newSettings }));
    },
    [dispatch, readerSettings],
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
        value={readerSettings.rendering.imageResamplingMethod}
        onChange={handleMethodChanged}
        size="small"
        autoWidth
      >
        {imageResamplingMethods.map((method) => (
          <MenuItem key={method} value={method}>
            {getResizeMethodLabel(method)}
          </MenuItem>
        ))}
      </Select>
    </ListItem>
  );
}
