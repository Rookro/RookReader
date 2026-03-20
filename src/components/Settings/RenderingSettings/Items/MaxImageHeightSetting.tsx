import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setMaxImageHeight } from "../../../../bindings/ContainerCommands";
import { RenderingSettings } from "../../../../types/Settings";
import NumberSpinner from "../../../NumberSpinner";

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

  const handleMaxHeightValueChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;
      setMaxHeight(height);

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
      <NumberSpinner
        value={maxHeight}
        min={0}
        step={100}
        size="small"
        error={isError}
        helperText={errorMsg}
        onValueCommitted={handleMaxHeightValueChange}
        sx={{ minWidth: "200px" }}
      />
      <Typography variant="body2" sx={{ marginLeft: 1 }}>
        px
      </Typography>
    </ListItem>
  );
}
