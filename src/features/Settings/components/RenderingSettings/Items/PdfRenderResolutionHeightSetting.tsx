import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setPdfRenderResolutionHeight } from "../../../../../bindings/ContainerCommands";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * PDF rendering setting component.
 */
export default function PdfRenderResolutionHeightSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const readerSettings = useAppSelector((state) => state.settings.reader);
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

      await dispatch(
        updateSettings({
          key: "reader",
          value: { rendering: { pdfRenderResolutionHeight: height } },
        }),
      );
    },
    [t, dispatch],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<AspectRatioOutlined />}
      primaryText={t("settings.rendering.pdf.title")}
      secondaryText={t("settings.rendering.pdf.description")}
      defaultValue={readerSettings.rendering.pdfRenderResolutionHeight}
      min={1}
      step={100}
      error={isError}
      helperText={errorMsg}
      onValueCommitted={handlePdfRenderResolutionHeightChange}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
