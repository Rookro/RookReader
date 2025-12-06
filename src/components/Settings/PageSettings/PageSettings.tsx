import { useTranslation } from "react-i18next";
import { Typography, Box } from "@mui/material";
import FirstPageSetting from "./Items/FirstPageSetting";

/**
 * Page settings component.
 */
export default function PageSettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.page.title')}</Typography>
            <FirstPageSetting />
        </Box>
    );
}
