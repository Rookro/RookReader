import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import HomeDirSetting from "./Items/HomeDirSetting"

/**
 * General settings component.
 */
export default function GeneralSettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.file-navigator.title')}</Typography>
            <HomeDirSetting />
        </Box>
    );
}
