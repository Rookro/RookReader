import { Box, Typography } from "@mui/material";
import LogSetting from "./Items/LogSetting";

/**
 * 開発者設定画面コンポーネント
 */
export default function DeveloperSettings() {
    return (
        <Box>
            <Typography variant="h5">Developer</Typography>
            <LogSetting />
        </Box>
    );
}
