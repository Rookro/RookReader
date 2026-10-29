import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useTranslation } from "react-i18next";
import { useNumberSettingField } from "../../../hooks/useNumberSettingField";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * PDF rendering setting component.
 */
export default function PdfRenderResolutionHeightSetting() {
  const { t } = useTranslation();
  const field = useNumberSettingField("reader.rendering.pdfRenderResolutionHeight");

  return (
    <NumberSpinnerSettingItem
      {...field}
      icon={<PictureAsPdfOutlined />}
      primaryText={t("settings.rendering.pdf.title")}
      secondaryText={t("settings.rendering.pdf.description")}
      step={100}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
