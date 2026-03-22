import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { setPdfRenderingHeight } from "../../../../bindings/ContainerCommands";
import NumberSpinner from "../../../NumberSpinner";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * PDF rendering setting component.
 */
export default function PdfRenderingSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { rendering: renderingSettings } = useAppSelector((state) => state.settings);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePdfRenderingHeightChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

      if (height < 1) {
        error(`Failed to set PDF rendering height (must be at least 1): ${height}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.pdf.range-error-message"));
        return;
      }

      try {
        await setPdfRenderingHeight(height);
      } catch (e) {
        error(`Failed to set PDF rendering height: ${e}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.pdf.error-message"));
        return;
      }

      setIsError(false);
      setErrorMsg("");

      const newSettings = { ...renderingSettings, "pdf-rendering-height": height };
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
        primary={t("settings.rendering.pdf.title")}
        secondary={t("settings.rendering.pdf.description")}
      />
      <NumberSpinner
        defaultValue={renderingSettings["pdf-rendering-height"]}
        min={1}
        step={100}
        size="small"
        error={isError}
        helperText={errorMsg}
        onValueCommitted={handlePdfRenderingHeightChange}
        sx={{ minWidth: "200px" }}
      />
      <Typography variant="body2" sx={{ marginLeft: 1 }}>
        px
      </Typography>
    </ListItem>
  );
}
