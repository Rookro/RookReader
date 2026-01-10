import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import HomeDirSetting from "./Items/HomeDirSetting"
import DirWatchSetting from "./Items/DirWatchSetting";

/**
 * File navigator settings component.
 */
export default function FileNavigatorSettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.file-navigator.title')}</Typography>
            <HomeDirSetting />
            <DirWatchSetting />
        </Box>
    );
}
