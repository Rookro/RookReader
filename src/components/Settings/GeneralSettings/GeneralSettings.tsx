import { Box, Typography } from "@mui/material";
import ThemeSetting from "./Items/ThemeSetting"

/**
 * 開発者設定画面コンポーネント
 */
export default function DeveloperSettings() {
    return (
        <Box>
            <Typography variant="h5">General</Typography>
            <ThemeSetting />
        </Box>
    );
}
