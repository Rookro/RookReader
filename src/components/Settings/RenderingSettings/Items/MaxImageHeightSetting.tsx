import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, TextField } from "@mui/material";
import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setMaxImageHeight } from "../../../../bindings/ContainerCommands";
import { RenderingSettings } from "../../../../types/Settings";

/**
 * Max image height setting component.
 */
export default function MaxImageHeightSetting() {
  const { t } = useTranslation();
  const [maxHeight, setMaxHeight] = useState<number>(0);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const height =
        (await settingsStore.get<RenderingSettings>("rendering"))?.["max-image-height"] ?? 0;
      setMaxHeight(height);
    };
    fetchSettings();
  }, []);

  const handleMaxHeightChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const height = parseInt(e.target.value, 10);
      setMaxHeight(height);

      if (isNaN(height)) {
        setIsError(true);
        setErrorMsg("");
        return;
      }

      if (height < 0) {
        setIsError(true);
        setErrorMsg(t("settings.rendering.resize.max-image-height.range-error-message"));
        return;
      }

      try {
        await setMaxImageHeight(height);
      } catch (e) {
        error(`Failed to set max image height: ${e}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.resize.max-image-height.error-message"));
        return;
      }

      setIsError(false);
      setErrorMsg("");

      const settings = await settingsStore.get<RenderingSettings>("rendering");
      settingsStore.set("rendering", { ...settings, "max-image-height": height });
    },
    [t],
  );

  return (
    <ListItem>
      <ListItemIcon>
        <AspectRatioOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.rendering.resize.max-image-height.title")}
        secondary={t("settings.rendering.resize.max-image-height.description")}
        sx={{ marginRight: "10px" }}
        slotProps={{ secondary: { sx: { whiteSpace: "pre-wrap" } } }}
      />
      <TextField
        type="number"
        variant="standard"
        value={maxHeight}
        onChange={handleMaxHeightChange}
        size="small"
        error={isError}
        helperText={errorMsg}
        slotProps={{ input: { inputProps: { min: 0, step: 100 } } }}
        sx={{ width: "80px" }}
      />
    </ListItem>
  );
}
