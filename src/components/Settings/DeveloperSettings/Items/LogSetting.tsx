import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, ListItem, ListItemIcon, ListItemText, MenuItem, Select, SelectChangeEvent, TextField } from "@mui/material";
import { FilterListOutlined, FolderOpen, SourceOutlined } from "@mui/icons-material";
import { openPath } from '@tauri-apps/plugin-opener';
import { appLogDir } from "@tauri-apps/api/path";
import { settingsStore } from "../../../../settings/SettingsStore";
import { LogSettings } from "../../../../types/LogSettingsType";

/**
 * Log setting component.
 */
export default function LogSetting() {
    const { t } = useTranslation();
    const [logDir, setLogDir] = useState<string>("");
    const [logLevel, setLogLevel] = useState<string>("");

    const handleFolderClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        await openPath(await appLogDir());
    }

    useEffect(() => {
        const initLogSettingsView = async () => {
            const logDirPath = await appLogDir();
            setLogDir(logDirPath);
            const logSettings = await settingsStore.get("log") as LogSettings | undefined;
            if (logSettings) {
                setLogLevel(logSettings.level);
            } else {
                setLogLevel("Info");
            };
        };
        initLogSettingsView();
    }, [])

    const handleLogLevelChanged = async (e: SelectChangeEvent) => {
        setLogLevel(e.target.value);
        await settingsStore.set("log", { level: e.target.value });
    }

    return (
        <>
            <ListItem>
                <ListItemIcon><SourceOutlined /></ListItemIcon>
                <ListItemText primary={t('settings.developer.log.log-directory')} />
                <TextField
                    variant="standard"
                    value={logDir}
                    size="small"
                    slotProps={{ input: { readOnly: true } }}
                    sx={{
                        width: '80%',
                        marginLeft: '4px',
                        marginRight: '4px',
                    }}
                />
                <IconButton size="small" onClick={handleFolderClicked} >
                    <FolderOpen />
                </IconButton>
            </ListItem>
            <ListItem>
                <ListItemIcon><FilterListOutlined /></ListItemIcon>
                <ListItemText
                    primary={t('settings.developer.log.log-level.title')}
                    secondary={t('settings.developer.log.log-level.description')}
                />
                <Select
                    label={t('settings.developer.log.log-level.title')}
                    variant="standard"
                    value={logLevel}
                    onChange={handleLogLevelChanged}
                    sx={{ minWidth: 80 }}
                    size="small"
                >
                    <MenuItem value="Trace">{t('settings.developer.log.log-level.trace')}</MenuItem>
                    <MenuItem value="Debug">{t('settings.developer.log.log-level.debug')}</MenuItem>
                    <MenuItem value="Info">{t('settings.developer.log.log-level.info')}</MenuItem>
                    <MenuItem value="Warn">{t('settings.developer.log.log-level.warn')}</MenuItem>
                    <MenuItem value="Error">{t('settings.developer.log.log-level.error')}</MenuItem>
                </Select>
            </ListItem>
        </>
    );
}
