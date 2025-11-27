import { Box, Typography } from "@mui/material";
import ThemeSetting from "./Items/ThemeSetting"

/**
 * General settings component.
 */
export default function GeneralSettings() {
    return (
        <Box>
            <Typography variant="h5">General</Typography>
            <ThemeSetting />
        </Box>
    );
}
