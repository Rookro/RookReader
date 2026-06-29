import { RestorePageOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * Restore on startup setting component.
 */
export default function RestoreLastBookSetting() {
  const { t } = useTranslation();
  const startupSettings = useAppSelector((state) => state.settings.startup);
  const dispatch = useAppDispatch();

  const handleRestoreLastBookChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(updateSettings({ key: "startup", value: { restoreLastBook: e.target.checked } }));
    },
    [dispatch],
  );

  return (
    <SwitchSettingItem
      icon={<RestorePageOutlined />}
      primaryText={t("settings.general.restore-last-read.title")}
      secondaryText={t("settings.general.restore-last-read.description")}
      checked={startupSettings.restoreLastBook}
      onChange={handleRestoreLastBookChanged}
    />
  );
}
