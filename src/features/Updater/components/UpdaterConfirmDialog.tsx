import { SystemUpdateAlt as UpdateIcon } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import type { Update } from "@tauri-apps/plugin-updater";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

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
            maxHeight: "80%",
            backgroundColor: "background.default",
          },
        },
      }}
    >
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

      <DialogContent sx={{ display: "flex", flexDirection: "column" }}>
        <Typography variant="body1" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>
          {t("updater.dialog-content", { version: update.version })}
        </Typography>

        {update.body && (
          <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 }}>
            <Divider sx={{ marginY: 2 }} />
            <Typography variant="subtitle2" sx={{ color: "text.secondary", marginBottom: 1 }}>
              {t("updater.dialog-release-notes")}
            </Typography>
            <Box
              sx={{
                overflowY: "auto",
                paddingRight: 1,
                flexGrow: 1,
                color: "text.secondary",
                "& p": { margin: "0px", fontSize: "0.9rem" },
                "& ul, & ol": { margin: "0px", paddingLeft: "20px", fontSize: "0.9rem" },
                "& h1, & h2, & h3": { marginY: "8px" },
                "& a": { color: "primary.main" },
                "& code": {
                  backgroundColor: "action.hover",
                  padding: "2px 4px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                },
              }}
            >
              <ReactMarkdown>{update.body}</ReactMarkdown>
            </Box>
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
