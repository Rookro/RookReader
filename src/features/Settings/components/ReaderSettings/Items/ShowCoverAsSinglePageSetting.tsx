import { AutoStoriesOutlined } from "@mui/icons-material";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * First page setting component.
 */
export default function ShowCoverAsSinglePageSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const handleFirstPageSingleViewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`"show cover as single page" switch changed to ${e.target.checked}`);
      await dispatch(
        updateSettings({
          key: "reader",
          value: { comic: { showCoverAsSinglePage: e.target.checked } },
        }),
      );
    },
    [dispatch],
  );

  return (
    <SwitchSettingItem
      icon={<AutoStoriesOutlined />}
      primaryText={t("settings.reader.first-page.title")}
      checked={readerSettings.comic.showCoverAsSinglePage}
      onChange={handleFirstPageSingleViewSwitchChange}
    />
  );
}
