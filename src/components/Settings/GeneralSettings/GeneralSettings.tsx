import { Box, Typography } from "@mui/material";
import "./GeneralSettings.css";
import ThemeSetting from "./Items/ThemeSetting"

function GeneralSettings() {
    return (
        <Box className="general-settings">
            <Typography variant="h5">General</Typography>
            <ThemeSetting />
        </Box>
    );
}

export default GeneralSettings;
