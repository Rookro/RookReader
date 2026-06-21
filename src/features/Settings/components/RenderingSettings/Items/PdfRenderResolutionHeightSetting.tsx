import { AspectRatioOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * PDF rendering setting component.
 */
export default function PdfRenderResolutionHeightSetting() {
  const { t } = useTranslation();
  const pdfRenderResolutionHeight = useAppSelector(
    (state) => state.settings.reader.rendering.pdfRenderResolutionHeight,
  );
  const { error, helperText, commit } = useSettingsFieldError(
    "reader.rendering.pdfRenderResolutionHeight",
    pdfRenderResolutionHeight,
  );

  const handlePdfRenderResolutionHeightChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

      // Send only the changed leaf; the backend validates the bound and, on rejection,
      // returns a structured violation the hook surfaces inline below the field.
      await commit({
        key: "reader",
        value: { rendering: { pdfRenderResolutionHeight: height } },
      });
    },
    [commit],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<AspectRatioOutlined />}
      primaryText={t("settings.rendering.pdf.title")}
      secondaryText={t("settings.rendering.pdf.description")}
      defaultValue={pdfRenderResolutionHeight}
      // Bounds mirror the backend garde validation (range(min = 1, max = 20000)).
      min={1}
      max={20000}
      step={100}
      error={error}
      helperText={helperText}
      onValueCommitted={handlePdfRenderResolutionHeightChange}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
