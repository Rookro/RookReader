import { AspectRatioOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import { SETTINGS_BOUNDS } from "../../../settingsBounds";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

const bounds = SETTINGS_BOUNDS["reader.rendering.pdfRenderResolutionHeight"];

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
      // A cleared field commits the current (always in-range) value instead of 0,
      // which is below the field's min of 1 and would always fail validation.
      const height = value ?? pdfRenderResolutionHeight;

      // Send only the changed leaf; the backend validates the bound and, on rejection,
      // returns a structured violation the hook surfaces inline below the field.
      await commit({
        key: "reader",
        value: { rendering: { pdfRenderResolutionHeight: height } },
      });
    },
    [commit, pdfRenderResolutionHeight],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<AspectRatioOutlined />}
      primaryText={t("settings.rendering.pdf.title")}
      secondaryText={t("settings.rendering.pdf.description")}
      defaultValue={pdfRenderResolutionHeight}
      min={bounds.min}
      max={bounds.max}
      step={100}
      error={error}
      helperText={helperText}
      onValueCommitted={handlePdfRenderResolutionHeightChange}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
