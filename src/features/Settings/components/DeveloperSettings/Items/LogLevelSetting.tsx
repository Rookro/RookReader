import { FilterListOutlined, FolderOpen, SourceOutlined } from "@mui/icons-material";
import {
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
} from "@mui/material";
import { appLogDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { LogLevel } from "../../../../../types/AppSettings";
import { updateSettings } from "../../../slice";

/**
 * Log setting component.
 */
export default function LogLevelSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const generalSettings = useAppSelector((state) => state.settings.general);
  const [logDir, setLogDir] = useState<string>("");

  const handleFolderClicked = useCallback(async (_e: React.MouseEvent<HTMLButtonElement>) => {
    await openPath(await appLogDir());
  }, []);

  useEffect(() => {
    const initLogLevelSettingsView = async () => {
      const logDirPath = await appLogDir();
      setLogDir(logDirPath);
    };
    initLogLevelSettingsView();
  }, []);

  const handleLogLevelChanged = useCallback(
    async (e: SelectChangeEvent) => {
      const newGeneralSettings = {
        ...generalSettings,
        log: { ...generalSettings.log, level: e.target.value as LogLevel },
      };
      await dispatch(updateSettings({ key: "general", value: newGeneralSettings }));
    },
    [dispatch, generalSettings],
  );

  return (
    <>
      <ListItem>
        <ListItemIcon>
          <SourceOutlined />
        </ListItemIcon>
        <ListItemText primary={t("settings.developer.log.log-directory")} />
        <TextField
          variant="standard"
          value={logDir}
          size="small"
          slotProps={{ input: { readOnly: true } }}
          sx={{
            width: "80%",
            marginLeft: "4px",
            marginRight: "4px",
          }}
        />
        <IconButton size="small" onClick={handleFolderClicked}>
          <FolderOpen />
        </IconButton>
      </ListItem>
      <ListItem>
        <ListItemIcon>
          <FilterListOutlined />
        </ListItemIcon>
        <ListItemText
          primary={t("settings.developer.log.log-level.title")}
          secondary={t("settings.developer.log.log-level.description")}
        />
        <Select
          label={t("settings.developer.log.log-level.title")}
          variant="standard"
          defaultValue={generalSettings.log.level}
          onChange={handleLogLevelChanged}
          size="small"
          autoWidth
        >
          <MenuItem value="trace">{t("settings.developer.log.log-level.trace")}</MenuItem>
          <MenuItem value="debug">{t("settings.developer.log.log-level.debug")}</MenuItem>
          <MenuItem value="info">{t("settings.developer.log.log-level.info")}</MenuItem>
          <MenuItem value="warn">{t("settings.developer.log.log-level.warn")}</MenuItem>
          <MenuItem value="error">{t("settings.developer.log.log-level.error")}</MenuItem>
        </Select>
      </ListItem>
    </>
  );
}
