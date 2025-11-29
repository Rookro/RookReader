import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import ThemeSetting from "./Items/ThemeSetting"
import LanguageSetting from "./Items/LanguageSettings";

/**
 * General settings component.
 */
export default function GeneralSettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.general.title')}</Typography>
            <LanguageSetting />
            <ThemeSetting />
        </Box>
    );
}
