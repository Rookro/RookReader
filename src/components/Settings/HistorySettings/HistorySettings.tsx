import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import FeatureToggle from "./Items/FeatureToggle";

/**
 * History settings component.
 */
export default function HistorySettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.history.title')}</Typography>
            <FeatureToggle />
        </Box>
    );
}
