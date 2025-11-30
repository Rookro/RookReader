import { useTranslation } from "react-i18next";
import { Typography, Box } from "@mui/material";
import PdfRenderingSetting from "./Items/PdfRenderingSetting";

/**
 * Rendering settings component.
 */
export default function RenderingSettings() {
    const { t } = useTranslation();

    return (
        <Box>
            <Typography variant="h5">{t('settings.rendering.title')}</Typography>
            <PdfRenderingSetting />
        </Box>
    );
}
