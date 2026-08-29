import SubdirectoryArrowRightOutlined from "@mui/icons-material/SubdirectoryArrowRightOutlined";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * Toggles descending into a single sub-folder when opening an archive.
 */
export default function AutoDescendSingleFolderSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const handleAutoDescendSingleFolderSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`"auto descend single folder" switch changed to ${e.target.checked}`);
      await dispatch(
        updateSettings({
          key: "reader",
          value: { autoDescendSingleFolder: e.target.checked },
        }),
      );
    },
    [dispatch],
  );

  return (
    <SwitchSettingItem
      icon={<SubdirectoryArrowRightOutlined />}
      primaryText={t("settings.reader.auto-descend-single-folder.title")}
      secondaryText={t("settings.reader.auto-descend-single-folder.description")}
      checked={readerSettings.autoDescendSingleFolder}
      onChange={handleAutoDescendSingleFolderSwitchChange}
    />
  );
}
