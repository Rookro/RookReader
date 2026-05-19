import { SystemUpdateAlt } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * Check for updates on startup setting component.
 */
export default function CheckUpdateOnStartupSetting() {
  const { t } = useTranslation();
  const startupSettings = useAppSelector((state) => state.settings.startup);
  const dispatch = useAppDispatch();

  const handleCheckUpdateChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStartupSettings = {
        ...startupSettings,
        checkUpdateOnStartup: e.target.checked,
      };
      dispatch(updateSettings({ key: "startup", value: newStartupSettings }));
    },
    [dispatch, startupSettings],
  );

  return (
    <SwitchSettingItem
      icon={<SystemUpdateAlt />}
      primaryText={t("settings.general.check-update-on-startup.title")}
      secondaryText={t("settings.general.check-update-on-startup.description")}
      defaultChecked={startupSettings.checkUpdateOnStartup ?? true}
      onChange={handleCheckUpdateChanged}
    />
  );
}
