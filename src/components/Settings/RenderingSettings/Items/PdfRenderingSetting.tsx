import { useEffect, useState } from "react";
import { Typography, Box, OutlinedInput } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { invoke } from "@tauri-apps/api/core";
import { settingsStore } from "../../../../settings/SettingsStore";

/**
 * PDFレンダリング設定コンポーネント
 */
export default function PdfRenderingSetting() {
    const [pdfRenderingHeight, setPdfRenderingHeight] = useState<number>(2000);

    useEffect(() => {
        const fetchSettings = async () => {
            const height = await settingsStore.get<number>("pdf-rendering-height") ?? 2000;
            setPdfRenderingHeight(height);
        };
        fetchSettings();
    }, []);

    const handlePdfRenderingHeightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const height = parseInt(e.target.value, 10);
        setPdfRenderingHeight(height);
        try {
            await invoke("set_pdf_rendering_height", { height: height });
        } catch (e) {
            error(`Failed to set PDF rendering height: ${e}`);
        }
        await settingsStore.set("pdf-rendering-height", height);
    };

    return (
        <Box display="flex">
            <Typography alignContent="center" sx={{ paddingRight: "12px" }}>PDF Rendering Height(px)</Typography>
            <OutlinedInput
                type="number"
                value={pdfRenderingHeight}
                onChange={handlePdfRenderingHeightChange}
                size="small"
            />
        </Box>
    );
}
