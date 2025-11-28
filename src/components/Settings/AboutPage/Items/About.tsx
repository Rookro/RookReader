import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { getName, getVersion } from '@tauri-apps/api/app';
import appIcon from '../../../../assets/app-icon.png';

/**
 * About component.
 */
export default function About() {
    const [appName, setAppName] = useState("");
    const [appVersion, setAppVersion] = useState("");

    useEffect(() => {
        const fetchAppInfo = async () => {
            const appName = await getName();
            setAppName(appName);
            const appVersion = await getVersion();
            setAppVersion(appVersion);
        }
        fetchAppInfo();
    }, [])

    return (
        <Stack direction="row" spacing={2} alignItems="center">
            <Box component="img" src={appIcon} sx={{ width: '100px' }} />
            <Stack direction="column">
                <Typography variant="h3">{appName}</Typography>
                <Typography variant="h5">version {appVersion}</Typography>
            </Stack>
        </Stack>
    )
}
