import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";

/** Props for the ConfirmDialog component. */
export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Dialog title, phrased as the question being asked. */
  title: string;
  /** Body text explaining what the action will do. */
  description: string;
  /** Label for the confirming button. */
  confirmLabel: string;
  /** Callback invoked when the user confirms. */
  onConfirm: () => void;
  /** Callback invoked when the user cancels or dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Confirmation dialog for destructive actions.
 *
 * Cancel is focused by default so an accidental Enter does not carry out the action.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onCancel} autoFocus sx={{ color: "text.secondary" }}>
          {t("common.cancel")}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
