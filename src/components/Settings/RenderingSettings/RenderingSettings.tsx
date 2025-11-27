import { Typography, Box } from "@mui/material";
import PdfRenderingSetting from "./Items/PdfRenderingSetting";

/**
 * Rendering settings component.
 */
export default function RenderingSettings() {
    return (
        <Box>
            <Typography variant="h5">Rendering</Typography>
            <PdfRenderingSetting />
        </Box>
    );
}
