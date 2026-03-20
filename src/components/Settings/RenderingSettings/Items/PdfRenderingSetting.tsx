import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setPdfRenderingHeight } from "../../../../bindings/ContainerCommands";
import { RenderingSettings } from "../../../../types/Settings";
import NumberSpinner from "../../../NumberSpinner";

/**
 * PDF rendering setting component.
 */
export default function PdfRenderingSetting() {
  const { t } = useTranslation();
  const [pdfRenderingHeight, setPdfRenderingHeightState] = useState<number>(2000);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const height =
        (await settingsStore.get<RenderingSettings>("rendering"))?.["pdf-rendering-height"] ?? 2000;
      setPdfRenderingHeightState(height);
    };
    fetchSettings();
  }, []);

  const handlePdfRenderingHeightChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;
      setPdfRenderingHeightState(height);

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

      const settings = await settingsStore.get<RenderingSettings>("rendering");
      settingsStore.set("rendering", { ...settings, "pdf-rendering-height": height });
    },
    [t],
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
        value={pdfRenderingHeight}
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
