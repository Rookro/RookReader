import { Typography } from "@mui/material";
import "./GeneralSettings.css";
import ThemeSetting from "./SettingItem/ThemeSetting";

function GeneralSettings() {
    return (
        <div className="general-settings">
            <Typography variant="h5">General</Typography>
            <ThemeSetting />
        </div >
    );
}

export default GeneralSettings;
