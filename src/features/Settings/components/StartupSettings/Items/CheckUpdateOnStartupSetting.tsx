import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SystemUpdateAlt } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";

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
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          defaultChecked={startupSettings.checkUpdateOnStartup ?? true}
          onChange={handleCheckUpdateChanged}
        />
      }
    >
      <ListItemIcon>
        <SystemUpdateAlt />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.startup.check-update-on-startup.title")}
        secondary={t("settings.startup.check-update-on-startup.description")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
