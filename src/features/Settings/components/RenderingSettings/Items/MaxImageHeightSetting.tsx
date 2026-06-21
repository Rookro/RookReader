import { AspectRatioOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../store/store";
import { useSettingsFieldError } from "../../../hooks/useSettingsFieldError";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Max image height setting component.
 */
export default function MaxImageHeightSetting() {
  const { t } = useTranslation();
  const maxImageHeight = useAppSelector((state) => state.settings.reader.rendering.maxImageHeight);
  const { error, helperText, commit } = useSettingsFieldError(
    "reader.rendering.maxImageHeight",
    maxImageHeight,
  );

  const handleMaxHeightValueChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

      // Send only the changed leaf; the backend deep-merges, validates, and on rejection
      // returns a structured violation that the hook surfaces inline below the field.
      await commit({ key: "reader", value: { rendering: { maxImageHeight: height } } });
    },
    [commit],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<AspectRatioOutlined />}
      primaryText={t("settings.rendering.resize.max-image-height.title")}
      secondaryText={t("settings.rendering.resize.max-image-height.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={maxImageHeight}
      // Bounds mirror the backend garde validation (range(min = 0, max = 65535)).
      min={0}
      max={65535}
      step={100}
      error={error}
      helperText={helperText}
      onValueCommitted={handleMaxHeightValueChange}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
