import AspectRatioOutlined from "@mui/icons-material/AspectRatioOutlined";
import { useTranslation } from "react-i18next";
import { useNumberSettingField } from "../../../hooks/useNumberSettingField";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Max image height setting component.
 */
export default function MaxImageHeightSetting() {
  const { t } = useTranslation();
  const field = useNumberSettingField("reader.rendering.maxImageHeight");

  return (
    <NumberSpinnerSettingItem
      {...field}
      icon={<AspectRatioOutlined />}
      primaryText={t("settings.rendering.resize.max-image-height.title")}
      secondaryText={t("settings.rendering.resize.max-image-height.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      step={100}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
