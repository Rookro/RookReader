import { useEffect, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { Folder } from "@mui/icons-material";
import { openPath } from '@tauri-apps/plugin-opener';
import { appLogDir } from "@tauri-apps/api/path";
import "./LogSetting.css";



function LogSetting() {
    const [logDir, setLogDir] = useState<string>("");

    const handleFolderClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        await openPath(await appLogDir());
    }

    useEffect(() => {
        const initLogDir = async () => {
            const logDirPath = await appLogDir();
            setLogDir(logDirPath);
        };
        initLogDir();
    }, [])

    return (
        <Box className="log-setting" display="flex">
            <Typography alignContent="center">Log File Path</Typography>
            <input type="text" readOnly value={logDir} style={{ marginLeft: '16px', marginRight: '5px', flexGrow: 1 }} />
            <IconButton size="small" onClick={handleFolderClicked} >
                <Folder />
            </IconButton>
        </Box>
    );
}

export default LogSetting;
