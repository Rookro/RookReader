import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Paper, Typography } from "@mui/material";
import { openPath } from "@tauri-apps/plugin-opener";
import { resolveResource } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";

/**
 * Third party component.
 */
export default function ThirdParty() {
  const { t } = useTranslation();

  const openLicense = useCallback(async (licenseFile: string) => {
    try {
      const licensePath = await resolveResource(`licenses/${licenseFile}`);
      await openPath(licensePath);
    } catch (e) {
      error(`Failed to open license file: ${e}`);
    }
  }, []);

  return (
    <Paper elevation={3} sx={{ padding: 2 }}>
      <Typography variant="h5">{t("settings.about.third-party-licenses.title")}</Typography>
      <Typography variant="body1" sx={{ marginTop: 1, marginBottom: 1 }}>
        {t("settings.about.third-party-licenses.body")}
      </Typography>
      <Box sx={{ display: "flex", gap: "10px", marginTop: 2 }}>
        <Button variant="outlined" onClick={() => openLicense("frontend-licenses.txt")}>
          {t("settings.about.third-party-licenses.frontend")}
        </Button>
        <Button variant="outlined" onClick={() => openLicense("backend-licenses.html")}>
          {t("settings.about.third-party-licenses.backend")}
        </Button>
      </Box>
      <Box sx={{ marginTop: 3 }}>
        <Typography variant="body1" sx={{ marginTop: 1, marginBottom: 1, color: "text.secondary" }}>
          {t("settings.about.third-party-licenses.bundled")}
        </Typography>
        <Button variant="outlined" onClick={() => openLicense("pdfium/")}>
          {t("settings.about.third-party-licenses.pdfium")}
        </Button>
      </Box>
    </Paper>
  );
}
