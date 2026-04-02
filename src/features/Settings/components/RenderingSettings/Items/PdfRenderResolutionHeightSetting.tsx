import { AspectRatioOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setPdfRenderResolutionHeight } from "../../../../../bindings/ContainerCommands";
import NumberSpinner from "../../../../../components/ui/NumberSpinner";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";

/**
 * PDF rendering setting component.
 */
export default function PdfRenderResolutionHeightSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { reader: readerSettings } = useAppSelector((state) => state.settings);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePdfRenderResolutionHeightChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

      if (height < 1) {
        error(`Failed to set PDF rendering height (must be at least 1): ${height}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.pdf.range-error-message"));
        return;
      }

      try {
        await setPdfRenderResolutionHeight(height);
      } catch (e) {
        error(`Failed to set PDF rendering height: ${e}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.pdf.error-message"));
        return;
      }

      setIsError(false);
      setErrorMsg("");

      const newSettings = {
        ...readerSettings,
        rendering: { ...readerSettings.rendering, pdfRenderResolutionHeight: height },
      };
      dispatch(updateSettings({ key: "reader", value: newSettings }));
    },
    [t, dispatch, readerSettings],
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
        defaultValue={readerSettings.rendering.pdfRenderResolutionHeight}
        min={1}
        step={100}
        size="small"
        error={isError}
        helperText={errorMsg}
        onValueCommitted={handlePdfRenderResolutionHeightChange}
        sx={{ minWidth: "200px" }}
      />
      <Typography variant="body2" sx={{ marginLeft: 1 }}>
        px
      </Typography>
    </ListItem>
  );
}
