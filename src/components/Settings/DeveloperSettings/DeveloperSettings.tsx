import { Box, Typography } from "@mui/material";
import LogSetting from "./Items/LogSetting";

/**
 * Developer settings component.
 */
export default function DeveloperSettings() {
    return (
        <Box>
            <Typography variant="h5">Developer</Typography>
            <LogSetting />
        </Box>
    );
}
