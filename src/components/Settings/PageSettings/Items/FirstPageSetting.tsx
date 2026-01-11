import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Switch, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { setIsFirstPageSingleView } from "../../../../reducers/ViewReducer";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";
import { AutoStoriesOutlined } from "@mui/icons-material";

/**
 * First page setting component.
 */
export default function FirstPageSetting() {
  const { t } = useTranslation();
  const { isFirstPageSingleView } = useAppSelector((state) => state.view);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const initSettings = async () => {
      const isFirstPageSingleView =
        (await settingsStore.get<boolean>("first-page-single-view")) ?? true;
      dispatch(setIsFirstPageSingleView(isFirstPageSingleView));
    };
    initSettings();
  }, [dispatch]);

  const handleFirstPageSingleViewSwitchChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      debug(`First page single view switch changed to ${e.target.checked}`);
      dispatch(setIsFirstPageSingleView(e.target.checked));
      await settingsStore.set("first-page-single-view", e.target.checked);

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
          checked={isFirstPageSingleView}
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
