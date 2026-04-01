import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RestorePageOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import { updateSettings } from "../../../slice";

/**
 * Restore on startup setting component.
 */
export default function RestoreLastBookSetting() {
  const { t } = useTranslation();
  const startupSettings = useAppSelector((state) => state.settings.startup);
  const dispatch = useAppDispatch();

  const handleRestoreLastBookChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStartupSettings = {
        ...startupSettings,
        restoreLastBook: e.target.checked,
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
          defaultChecked={startupSettings.restoreLastBook}
          onChange={handleRestoreLastBookChanged}
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
