import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListItem, ListItemIcon, ListItemText, TextField } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setPdfRenderingHeight } from "../../../../bindings/ContainerCommands";
import { AspectRatioOutlined } from "@mui/icons-material";

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
      const height = (await settingsStore.get<number>("pdf-rendering-height")) ?? 2000;
      setPdfRenderingHeightState(height);
    };
    fetchSettings();
  }, []);

  const handlePdfRenderingHeightChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const height = parseInt(e.target.value, 10);
      setPdfRenderingHeightState(height);

      if (isNaN(height)) {
        setIsError(true);
        setErrorMsg("");
        return;
      }

      if (height < 1) {
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

      await settingsStore.set("pdf-rendering-height", height);
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
      <TextField
        type="number"
        variant="standard"
        value={pdfRenderingHeight}
        onChange={handlePdfRenderingHeightChange}
        size="small"
        error={isError}
        helperText={errorMsg}
        slotProps={{ input: { inputProps: { min: 1, step: 100 } } }}
        sx={{ width: "80px" }}
      />
    </ListItem>
  );
}
