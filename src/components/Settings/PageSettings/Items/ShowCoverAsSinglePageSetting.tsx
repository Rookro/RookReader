import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Switch, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { AutoStoriesOutlined } from "@mui/icons-material";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * First page setting component.
 */
export default function FirstPageSetting() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();

  const handleFirstPageSingleViewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`"show cover as single page" switch changed to ${e.target.checked}`);
      const newSettings = {
        ...readerSettings,
        comic: {
          ...readerSettings.comic,
          showCoverAsSinglePage: e.target.checked,
        },
      };
      dispatch(updateSettings({ key: "reader", value: newSettings }));

      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { reader: newSettings },
      });
    },
    [dispatch, readerSettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={readerSettings.comic.showCoverAsSinglePage}
          onChange={handleFirstPageSingleViewSwitchChange}
        />
      }
    >
      <ListItemIcon>
        <AutoStoriesOutlined />
      </ListItemIcon>
      <ListItemText primary={t("settings.page.first-page.title")} sx={{ marginRight: 3 }} />
    </ListItem>
  );
}
