import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import { SETTINGS_BOUNDS } from "../../../settingsBounds";
import { defaultSettings } from "../../../settingsStore";
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
      const height = value ?? defaultSettings.reader.rendering.pdfRenderResolutionHeight;

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
      icon={<PictureAsPdfOutlined />}
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
