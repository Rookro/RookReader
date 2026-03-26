import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import { SystemUpdateAlt as UpdateIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { Update } from "@tauri-apps/plugin-updater";

export interface UpdaterConfirmDialogProps {
  open: boolean;
  update: Update | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function UpdaterConfirmDialog({
  open,
  update,
  onConfirm,
  onCancel,
}: UpdaterConfirmDialogProps) {
  const { t } = useTranslation();

  if (!update) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="updater-confirm-dialog-title"
      slotProps={{
        paper: {
          sx: {
            minWidth: { xs: "300px", sm: "480px" },
            maxWidth: "600px",
            backgroundColor: "background.default",
          },
        },
      }}
    >
      {/* 1. タイトルとアイコン */}
      <DialogTitle
        id="updater-confirm-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <UpdateIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          {t("updater.dialog-title")}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>
          {t("updater.dialog-content", { version: update.version })}
        </Typography>

        {update.body && (
          <Box>
            <Divider sx={{ marginY: 2 }} />
            <Typography variant="subtitle2" sx={{ color: "text.secondary", marginBottom: 1 }}>
              {t("updater.dialog-release-notes")}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "pre-wrap",
                color: "text.secondary",
                maxHeight: "100px",
                overflowY: "auto",
                paddingRight: 1,
              }}
            >
              {update.body}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ paddingX: 3, paddingBottom: 3 }}>
        <Button
          onClick={onCancel}
          sx={{
            color: "text.secondary",
            textTransform: "none",
          }}
        >
          {t("updater.dialog-update-cancel-label")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onConfirm}
          sx={{ textTransform: "none" }}
        >
          {t("updater.dialog-update-label")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
