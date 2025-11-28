import { useEffect, useState } from "react";
import { Box, Link, Stack, Typography } from "@mui/material";
import { GitHub } from '@mui/icons-material';
import { getName, getVersion } from '@tauri-apps/api/app';
import { openUrl } from "@tauri-apps/plugin-opener";
import { error } from "@tauri-apps/plugin-log";
import appIcon from '../../../../assets/app-icon.png';

/**
 * About component.
 */
export default function About() {
    const [appName, setAppName] = useState("");
    const [appVersion, setAppVersion] = useState("");
    const projectUrl = 'https://github.com/Rookro/RookReader';

    useEffect(() => {
        const fetchAppInfo = async () => {
            const appName = await getName();
            setAppName(appName);
            const appVersion = await getVersion();
            setAppVersion(appVersion);
        }
        fetchAppInfo();
    }, [])

    const handleLinkClick = async (_e: React.MouseEvent) => {
        try {
            await openUrl(projectUrl);
        } catch (e) {
            error(`Failed to open the project page: ${e}`);
        }
    }

    return (
        <Stack direction="row" spacing={2} alignItems="center">
            <Box component="img" src={appIcon} sx={{ width: '100px' }} />
            <Stack direction="column">
                <Typography variant="h3">{appName}</Typography>
                <Typography variant="h5">version {appVersion}</Typography>
                <Link
                    component="button"
                    variant="body1"
                    onClick={handleLinkClick}
                    sx={{ width: "fit-content" }}
                >
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <GitHub fontSize="small" />
                        <Typography variant="body1">Project Page</Typography>
                    </Stack>
                </Link>
            </Stack>
        </Stack>
    )
}
