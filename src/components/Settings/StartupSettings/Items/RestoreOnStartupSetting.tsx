import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RestorePageOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * Restore on startup setting component.
 */
export default function RestoreOnStartupSetting() {
  const { t } = useTranslation();
  const { history: historySettings } = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();

  const handleRestoreFeatureToggleChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newHistorySettings = {
        ...historySettings,
        "restore-last-container-on-startup": e.target.checked,
      };
      dispatch(updateSettings({ key: "history", value: newHistorySettings }));
    },
    [dispatch, historySettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={historySettings["restore-last-container-on-startup"]}
          onChange={handleRestoreFeatureToggleChanged}
        />
      }
    >
      <ListItemIcon>
        <RestorePageOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.startup.restore-last-read.title")}
        secondary={t("settings.startup.restore-last-read.description")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
