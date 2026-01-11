import { useEffect, useState } from "react";
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

  useEffect(() => {
    const fetchSettings = async () => {
      const height = (await settingsStore.get<number>("pdf-rendering-height")) ?? 2000;
      setPdfRenderingHeightState(height);
    };
    fetchSettings();
  }, []);

  const handlePdfRenderingHeightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const height = parseInt(e.target.value, 10);
    setPdfRenderingHeightState(height);
    try {
      await setPdfRenderingHeight(height);
    } catch (e) {
      error(`Failed to set PDF rendering height: ${e}`);
    }
    await settingsStore.set("pdf-rendering-height", height);
  };

  return (
    <ListItem>
      <ListItemIcon>
        <AspectRatioOutlined />
      </ListItemIcon>
      <ListItemText primary={t("settings.rendering.pdf.title")} />
      <TextField
        type="number"
        variant="standard"
        value={pdfRenderingHeight}
        onChange={handlePdfRenderingHeightChange}
        size="small"
      />
    </ListItem>
  );
}
