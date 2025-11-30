import { useTranslation } from "react-i18next";
import { Typography, Stack } from "@mui/material";
import About from "./Items/About";
import ThirdParty from "./Items/ThirdParty";

/**
 * About page component.
 */
export default function AboutPage() {
    const { t } = useTranslation();

    return (
        <Stack spacing={3}>
            <Typography variant="h5">{t('settings.about.title')}</Typography>
            <About />
            <ThirdParty />
        </Stack>
    );
}
