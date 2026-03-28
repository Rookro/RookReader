import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Typography,
  Box,
} from "@mui/material";
import { ErrorOutline, InfoOutlined, ContentCopy, Check } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

export interface UpdaterMessageDialogProps {
  open: boolean;
  title: string;
  message: string;
  isError?: boolean;
  onClose: () => void;
}

export default function UpdaterMessageDialog({
  open,
  title,
  message,
  isError,
  onClose,
}: UpdaterMessageDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message);
    setCopied(true);

    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }

    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
    }, 5000);
  }, [message]);

  useEffect(() => {
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="updater-message-dialog-title"
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
      <DialogTitle
        id="updater-message-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          color: isError ? "error.main" : "text.primary",
        }}
      >
        {isError ? <ErrorOutline color="error" /> : <InfoOutlined color="primary" />}
        <Typography variant="h6">{title}</Typography>
      </DialogTitle>

      <DialogContent>
        <DialogContentText
          variant="body1"
          sx={{
            whiteSpace: "pre-wrap",
            color: "text.secondary",
          }}
        >
          {message}
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ paddingX: 3, paddingBottom: 3, justifyContent: "space-between" }}>
        {isError ? (
          <Button
            startIcon={copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
            onClick={handleCopy}
            size="small"
            sx={{
              textTransform: "none",
              color: "text.secondary",
              "&:hover": { backgroundColor: "transparent", color: "text.primary" },
            }}
          >
            {copied ? t("updater.dialog-error-copied") : t("updater.dialog-error-copy")}
          </Button>
        ) : (
          <Box />
        )}

        <Button
          variant="contained"
          color={isError ? "error" : "primary"}
          onClick={onClose}
          disableElevation
          sx={{ textTransform: "none" }}
        >
          {t("updater.dialog-close-label")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
