import { TextRotationNoneOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

/**
 * Auto scroll toggle component for bookshelf titles.
 */
export default function EnableAutoScrollSetting() {
  const { t } = useTranslation();
  const bookshelfSettings = useAppSelector((state) => state.settings.bookshelf);
  const dispatch = useAppDispatch();

  const handleAutoScrollChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newBookshelfSettings = { ...bookshelfSettings, enableAutoScroll: e.target.checked };
      await dispatch(updateSettings({ key: "bookshelf", value: newBookshelfSettings }));
      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { bookshelf: newBookshelfSettings },
      });
    },
    [dispatch, bookshelfSettings],
  );

  return (
    <ListItem
      secondaryAction={
        <Switch
          edge="end"
          checked={bookshelfSettings.enableAutoScroll}
          onChange={handleAutoScrollChanged}
        />
      }
    >
      <ListItemIcon>
        <TextRotationNoneOutlined />
      </ListItemIcon>
      <ListItemText
        primary={t("settings.bookshelf.auto-scroll.title")}
        secondary={t("settings.bookshelf.auto-scroll.description")}
        sx={{ marginRight: 3 }}
      />
    </ListItem>
  );
}
