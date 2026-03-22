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
  const isFirstPageSingleView = useAppSelector((state) => state.settings["first-page-single-view"]);
  const dispatch = useAppDispatch();

  const handleFirstPageSingleViewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`First page single view switch changed to ${e.target.checked}`);
      dispatch(updateSettings({ key: "first-page-single-view", value: e.target.checked }));

      await emit<SettingsChangedEvent>("settings-changed", {
        view: { isFirstPageSingleView: e.target.checked },
      });
    },
    [dispatch],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={isFirstPageSingleView}
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
