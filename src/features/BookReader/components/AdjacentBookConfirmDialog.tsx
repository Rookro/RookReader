import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { Trans, useTranslation } from "react-i18next";

/** Props for the AdjacentBookConfirmDialog component. */
export interface AdjacentBookConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** The display name of the book to open. */
  title?: string;
  /** Callback when the user confirms opening the book. */
  onConfirm: () => void;
  /** Callback when the user cancels. */
  onCancel: () => void;
}

/**
 * Confirmation dialog shown before opening the adjacent book in "ask" mode.
 */
export default function AdjacentBookConfirmDialog({
  open,
  title,
  onConfirm,
  onCancel,
}: AdjacentBookConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{t("book-reader.adjacent-book.confirm.title")}</DialogTitle>

      <DialogContent>
        <DialogContentText>
          <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
            <Trans
              i18nKey="book-reader.adjacent-book.confirm.message"
              values={{ title: title ?? "" }}
              components={{
                bold: <Box component="span" fontWeight="bold" color="text.primary" />,
              }}
            />
          </Box>
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onCancel} sx={{ color: "text.secondary" }}>
          {t("book-reader.adjacent-book.confirm.cancel")}
        </Button>
        <Button onClick={onConfirm} variant="contained" autoFocus>
          {t("book-reader.adjacent-book.confirm.open")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
