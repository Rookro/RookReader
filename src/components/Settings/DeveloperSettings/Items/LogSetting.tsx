import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
} from "@mui/material";
import { FilterListOutlined, FolderOpen, SourceOutlined } from "@mui/icons-material";
import { openPath } from "@tauri-apps/plugin-opener";
import { appLogDir } from "@tauri-apps/api/path";
import { LogLevel } from "../../../../types/LogLevelType";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";

/**
 * Log setting component.
 */
export default function LogSetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { log: logSettings } = useAppSelector((state) => state.settings);
  const [logDir, setLogDir] = useState<string>("");

  const handleFolderClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
    await openPath(await appLogDir());
  };

  useEffect(() => {
    const initLogSettingsView = async () => {
      const logDirPath = await appLogDir();
      setLogDir(logDirPath);
    };
    initLogSettingsView();
  }, []);

  const handleLogLevelChanged = useCallback(
    async (e: SelectChangeEvent) => {
      const newLogSettings = { ...logSettings };
      newLogSettings.level = e.target.value as LogLevel;
      await dispatch(updateSettings({ key: "log", value: newLogSettings }));
    },
    [dispatch, logSettings],
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
          defaultValue={logSettings.level}
          onChange={handleLogLevelChanged}
          size="small"
          autoWidth
        >
          <MenuItem value="Trace">{t("settings.developer.log.log-level.trace")}</MenuItem>
          <MenuItem value="Debug">{t("settings.developer.log.log-level.debug")}</MenuItem>
          <MenuItem value="Info">{t("settings.developer.log.log-level.info")}</MenuItem>
          <MenuItem value="Warn">{t("settings.developer.log.log-level.warn")}</MenuItem>
          <MenuItem value="Error">{t("settings.developer.log.log-level.error")}</MenuItem>
        </Select>
      </ListItem>
    </>
  );
}
