import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { setMaxImageHeight } from "../../../../bindings/ContainerCommands";
import NumberSpinner from "../../../NumberSpinner";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * Max image height setting component.
 */
export default function MaxImageHeightSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { rendering: renderingSettings } = useAppSelector((state) => state.settings);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleMaxHeightValueChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

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

      const newSettings = { ...renderingSettings, "max-image-height": height };
      dispatch(updateSettings({ key: "rendering", value: newSettings }));
    },
    [t, dispatch, renderingSettings],
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
        defaultValue={renderingSettings["max-image-height"]}
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
