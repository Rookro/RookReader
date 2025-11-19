import { Box, Typography } from "@mui/material";
import "./DeveloperSettings.css";
import LogSetting from "./Items/LogSetting"

/**
 * 開発者設定画面コンポーネント
 */
function DeveloperSettings() {
    return (
        <Box className="developer-settings">
            <Typography variant="h5">Developer</Typography>
            <LogSetting />
        </Box>
    );
}

export default DeveloperSettings;
