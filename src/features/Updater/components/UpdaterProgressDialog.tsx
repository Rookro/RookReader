import CloudDownloadOutlined from "@mui/icons-material/CloudDownloadOutlined";
import { Box, Dialog, DialogContent, DialogTitle, LinearProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Props for UpdaterProgressDialog.
 */
export interface UpdaterProgressDialogProps {
  isUpdating: boolean;
  updateStatus: string;
  updateProgress: number;
}

/**
 * Dialog to show the progress of an application update.
 */
export default function UpdaterProgressDialog({
  isUpdating,
  updateStatus,
  updateProgress,
}: UpdaterProgressDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={isUpdating}
      disableEscapeKeyDown
      slotProps={{
        paper: {
          sx: {
            minWidth: { xs: "300px", sm: "480px" },
            maxWidth: "600px",
            padding: 1,
            backgroundColor: "background.default",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          pb: 1,
        }}
      >
        <CloudDownloadOutlined color="primary" />
        <Typography variant="h6" component="span" fontWeight="bold">
          {/* The status already names the current phase (downloading, then installing),
              so drive the title from it rather than always claiming to install. */}
          {updateStatus || t("updater.installing")}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", justifyContent: "flex-end", marginBottom: 1, paddingX: 0.5 }}>
          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: "bold" }}>
            {Math.round(updateProgress)}%
          </Typography>
        </Box>

        <Box sx={{ width: "100%", marginBottom: 3 }}>
          <LinearProgress
            variant="determinate"
            value={updateProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "action.hover",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
              },
            }}
          />
        </Box>

        <Typography
          variant="caption"
          sx={{
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          {t("updater.restart")}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
