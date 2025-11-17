import { Box, IconButton, Typography } from "@mui/material";
import "./LogSetting.css";
import { Folder } from "@mui/icons-material";
import { openPath } from '@tauri-apps/plugin-opener';
import { appLogDir } from "@tauri-apps/api/path";


function LogSetting() {
    const handleFolderClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        await openPath(await appLogDir());
    }

    return (
        <Box className="log-setting" display="flex">
            <Typography alignContent="center">Log File Path</Typography>
            <input type="text" readOnly value="/path/to/log/file.log" style={{ marginLeft: '16px', marginRight: '5px', flexGrow: 1 }} />
            <IconButton size="small" onClick={handleFolderClicked}>
                <Folder />
            </IconButton>
        </Box>
    );
}

export default LogSetting;
