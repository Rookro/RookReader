import { useCallback, } from "react";
import { Box, Button, Typography } from "@mui/material";
import { openPath } from '@tauri-apps/plugin-opener';
import { resolveResource } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";

/**
 * Third party component.
 */
export default function ThirdParty() {
    const openLicense = useCallback(
        async (licenseFile: string) => {
            try {
                const licensePath = await resolveResource(`licenses/${licenseFile}`);
                await openPath(licensePath);
            } catch (e) {
                error(`Failed to open license file: ${e}`);
            }
        }, []);

    return (
        <Box sx={{ padding: '10px', borderRadius: '8px', bgcolor: 'background.paper' }}>
            <Typography variant="h5">
                Third-Party Licenses
            </Typography>
            <Typography variant="body1" sx={{ marginTop: 1, marginBottom: 1 }}>
                This application is built with open source software.
            </Typography>
            <Box sx={{ display: 'flex', gap: '10px', marginTop: 2 }}>
                <Button variant="outlined" onClick={() => openLicense('frontend-licenses.txt')}>
                    Frontend Licenses (yarn)
                </Button>
                <Button variant="outlined" onClick={() => openLicense('backend-licenses.html')}>
                    Backend Licenses (cargo)
                </Button>
            </Box>
            <Box sx={{ marginTop: 3 }}>
                <Typography variant="body1" sx={{ marginTop: 1, marginBottom: 1, color: 'text.secondary' }}>
                    Boundled Library Licenses
                </Typography>
                <Button variant="outlined" onClick={() => openLicense('pdfium/')}>
                    PDFium License
                </Button>
            </Box>
        </Box>
    )
}
