import { FontDownloadOutlined } from "@mui/icons-material";
import { MenuItem, type SelectChangeEvent } from "@mui/material";
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
import SelectSettingItem from "../../ui/SelectSettingItem";

/**
 * Image resize setting component.
 */
export default function ImageResamplingMethodSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const getResizeMethodLabel = useCallback(
    (method: string) => {
      switch (method) {
        case "nearest":
          return t("settings.rendering.resize.resize-method.nearest");
        case "box":
          return t("settings.rendering.resize.resize-method.box");
        case "bilinear":
          return t("settings.rendering.resize.resize-method.bilinear");
        case "hamming":
          return t("settings.rendering.resize.resize-method.hamming");
        case "catmullRom":
          return t("settings.rendering.resize.resize-method.catmullRom");
        case "mitchellNetravali":
          return t("settings.rendering.resize.resize-method.mitchellNetravali");
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
        await setImageResamplingMethod(e.target.value as string);
      } catch (e) {
        error(`Failed to set image resampling method: ${e}`);
        return;
      }
      await dispatch(
        updateSettings({
          key: "reader",
          value: { rendering: { imageResamplingMethod: e.target.value as ImageResamplingMethod } },
        }),
      );
    },
    [dispatch],
  );

  return (
    <SelectSettingItem
      icon={<FontDownloadOutlined />}
      primaryText={t("settings.rendering.resize.resize-method.title")}
      secondaryText={t("settings.rendering.resize.resize-method.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      value={readerSettings.rendering.imageResamplingMethod}
      onChange={handleMethodChanged}
    >
      {imageResamplingMethods.map((method) => (
        <MenuItem key={method} value={method}>
          {getResizeMethodLabel(method)}
        </MenuItem>
      ))}
    </SelectSettingItem>
  );
}
