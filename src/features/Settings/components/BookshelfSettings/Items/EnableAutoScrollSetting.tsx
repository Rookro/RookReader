import { TextRotationNoneOutlined } from "@mui/icons-material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";
import SwitchSettingItem from "../../ui/SwitchSettingItem";

/**
 * Auto scroll toggle component for bookshelf titles.
 */
export default function EnableAutoScrollSetting() {
  const { t } = useTranslation();
  const bookshelfSettings = useAppSelector((state) => state.settings.bookshelf);
  const dispatch = useAppDispatch();

  const handleAutoScrollChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await dispatch(
        updateSettings({ key: "bookshelf", value: { enableAutoScroll: e.target.checked } }),
      );
    },
    [dispatch],
  );

  return (
    <SwitchSettingItem
      icon={<TextRotationNoneOutlined />}
      primaryText={t("settings.bookshelf.auto-scroll.title")}
      secondaryText={t("settings.bookshelf.auto-scroll.description")}
      checked={bookshelfSettings.enableAutoScroll}
      onChange={handleAutoScrollChanged}
    />
  );
}
