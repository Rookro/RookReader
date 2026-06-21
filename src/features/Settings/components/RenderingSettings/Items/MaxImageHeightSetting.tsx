import { AspectRatioOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import NumberSpinnerSettingItem from "../../ui/NumberSpinnerSettingItem";

/**
 * Max image height setting component.
 */
export default function MaxImageHeightSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const readerSettings = useAppSelector((state) => state.settings.reader);

  const handleMaxHeightValueChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

      // Send only the changed leaf; updateSettings deep-merges it into the current
      // reader settings. Validation happens in the backend (apply_reader_settings_to_container
      // applies it at runtime), so the granular setter command is no longer needed.
      await dispatch(
        updateSettings({ key: "reader", value: { rendering: { maxImageHeight: height } } }),
      );
    },
    [dispatch],
  );

  return (
    <NumberSpinnerSettingItem
      icon={<AspectRatioOutlined />}
      primaryText={t("settings.rendering.resize.max-image-height.title")}
      secondaryText={t("settings.rendering.resize.max-image-height.description")}
      secondaryTextSx={{ whiteSpace: "pre-wrap" }}
      defaultValue={readerSettings.rendering.maxImageHeight}
      min={0}
      step={100}
      onValueCommitted={handleMaxHeightValueChange}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
