import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, IconButton, MenuItem, OutlinedInput, Select, SelectChangeEvent, Stack, Typography } from "@mui/material";
import { Folder } from "@mui/icons-material";
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
        <Stack spacing={1} >
            <Box display="flex">
                <Typography alignContent="center">{t('settings.developer.log.log-directory')}</Typography>
                <OutlinedInput
                    type="text"
                    value={logDir}
                    size="small"
                    readOnly
                    sx={{
                        width: '80%',
                        marginLeft: '16px',
                        marginRight: '5px',
                    }}
                />
                <IconButton size="small" onClick={handleFolderClicked} >
                    <Folder />
                </IconButton>
            </Box>
            <Box className="log-level" display="flex">
                <Typography alignContent="center">{t('settings.developer.log.log-level.title')}</Typography>
                <Select
                    size="small"
                    value={logLevel}
                    onChange={handleLogLevelChanged}
                    sx={{ marginLeft: '16px', marginRight: '16px' }}
                >
                    <MenuItem value="Trace">{t('settings.developer.log.log-level.trace')}</MenuItem>
                    <MenuItem value="Debug">{t('settings.developer.log.log-level.debug')}</MenuItem>
                    <MenuItem value="Info">{t('settings.developer.log.log-level.info')}</MenuItem>
                    <MenuItem value="Warn">{t('settings.developer.log.log-level.warn')}</MenuItem>
                    <MenuItem value="Error">{t('settings.developer.log.log-level.error')}</MenuItem>
                </Select>
                <Typography variant="body2" alignContent="center">{t('settings.developer.log.log-level.description')}</Typography>
            </Box>
        </Stack>
    );
}
