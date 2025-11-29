import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import LogSetting from "./Items/LogSetting";

/**
 * Developer settings component.
 */
export default function DeveloperSettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.developer.title')}</Typography>
            <LogSetting />
        </Box>
    );
}
