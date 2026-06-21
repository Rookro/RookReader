import { AspectRatioOutlined } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setMaxImageHeight } from "../../../../../bindings/ContainerCommands";
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
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleMaxHeightValueChange = useCallback(
    async (value: number | null) => {
      const height = value ?? 0;

      try {
        await setMaxImageHeight(height);
      } catch (e) {
        error(`Failed to set max image height: ${e}`);
        setIsError(true);
        setErrorMsg(t("settings.rendering.resize.max-image-height.error-message"));
        return;
      }

      setIsError(false);
      setErrorMsg("");

      await dispatch(
        updateSettings({ key: "reader", value: { rendering: { maxImageHeight: height } } }),
      );
    },
    [t, dispatch],
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
      error={isError}
      helperText={errorMsg}
      onValueCommitted={handleMaxHeightValueChange}
      inputSx={{ minWidth: "200px" }}
      unit="px"
    />
  );
}
