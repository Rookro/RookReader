import { useEffect, useState } from "react";
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
                <Typography alignContent="center">Log Directory</Typography>
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
                <Typography alignContent="center">Log Level</Typography>
                <Select
                    size="small"
                    value={logLevel}
                    onChange={handleLogLevelChanged}
                    sx={{ marginLeft: '16px', marginRight: '16px' }}
                >
                    <MenuItem value="Trace">Trace</MenuItem>
                    <MenuItem value="Debug">Debug</MenuItem>
                    <MenuItem value="Info">Info</MenuItem>
                    <MenuItem value="Warn">Warn</MenuItem>
                    <MenuItem value="Error">Error</MenuItem>
                </Select>
                <Typography variant="body2" alignContent="center">A restart of the application is required to apply the log level settings.</Typography>
            </Box>
        </Stack>
    );
}
