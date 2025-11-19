import { Box, Typography } from "@mui/material";
import "./GeneralSettings.css";
import ThemeSetting from "./Items/ThemeSetting"

/**
 * 開発者設定画面コンポーネント
 */
function DeveloperSettings() {
    return (
        <Box className="developer-settings">
            <Typography variant="h5">General</Typography>
            <ThemeSetting />
        </Box>
    );
}

export default DeveloperSettings;
