import "./RenderingSettings.css";
import { Typography, Box } from "@mui/material";
import PdfRenderingSetting from "./Items/PdfRenderingSetting";

/**
 * レンダリング設定コンポーネント
 */
export default function RenderingSettings() {
    return (
        <Box className="rendering-settings">
            <Typography variant="h5"> Rendering </Typography>
            <PdfRenderingSetting />
        </Box>
    );
}
