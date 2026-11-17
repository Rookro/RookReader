import DeleteSweepOutlined from "@mui/icons-material/DeleteSweepOutlined";
import { Button, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../../components/ui/ConfirmDialog";
import { useNotification } from "../../../../../components/ui/Notification/NotificationContext";
import { useAppDispatch } from "../../../../../store/store";
import { clearAllHistory } from "../../../../History/slice";

/**
 * Clears all reading history after a confirmation; usable while recording is off.
 */
export default function ClearHistorySetting() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { showNotification } = useNotification();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConfirmed = useCallback(async () => {
    setIsDialogOpen(false);
    const action = await dispatch(clearAllHistory());
    if (clearAllHistory.fulfilled.match(action)) {
      showNotification(t("settings.reader.clear-history.done"));
    }
  }, [dispatch, showNotification, t]);

  return (
    <>
      <ListItem
        secondaryAction={
          <Button variant="outlined" color="error" onClick={() => setIsDialogOpen(true)}>
            {t("settings.reader.clear-history.button")}
          </Button>
        }
      >
        <ListItemIcon>
          <DeleteSweepOutlined />
        </ListItemIcon>
        <ListItemText
          primary={t("settings.reader.clear-history.title")}
          secondary={t("settings.reader.clear-history.description")}
          sx={{ marginRight: 12 }}
        />
      </ListItem>
      <ConfirmDialog
        open={isDialogOpen}
        title={t("book-reader.history-viewer.clear-all-dialog.title")}
        description={t("book-reader.history-viewer.clear-all-dialog.description")}
        confirmLabel={t("book-reader.history-viewer.clear-all-dialog.confirm")}
        onConfirm={handleConfirmed}
        onCancel={() => setIsDialogOpen(false)}
      />
    </>
  );
}
