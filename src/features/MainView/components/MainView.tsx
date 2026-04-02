import { Box, type SxProps, type Theme } from "@mui/material";
import { lazy, useEffect } from "react";
import { useAppSelector } from "../../../store/store";
import { useSettingsChange } from "../../Settings/hooks/useSettingsChange";
import UpdaterConfirmDialog from "../../Updater/components/UpdaterConfirmDialog";
import UpdaterMessageDialog from "../../Updater/components/UpdaterMessageDialog";
import UpdaterProgressDialog from "../../Updater/components/UpdaterProgressDialog";
import { useUpdater } from "../../Updater/hooks/useUpdater";

const BookReader = lazy(() => import("../../BookReader/components/BookReader"));
const Bookshelf = lazy(() => import("../../Bookshelf/components/Bookshelf"));

/**
 * Props for the main content component
 */
export interface MainContentProps {
  /** Styles for the main content component */
  sx?: SxProps<Theme>;
}

/**
 * Main content component
 */
export default function MainContent({ sx }: MainContentProps) {
  useSettingsChange();
  const { activeView } = useAppSelector((state) => state.view);
  const checkUpdateOnStartup = useAppSelector(
    (state) => state.settings.startup.checkUpdateOnStartup,
  );
  const {
    checkForUpdates,
    isUpdating,
    updateProgress,
    updateStatus,
    confirmDialogOpen,
    currentUpdate,
    handleConfirmUpdate,
    handleCancelUpdate,
    messageDialogOpen,
    messageDialogTitle,
    messageDialogText,
    messageDialogIsError,
    closeMessageDialog,
  } = useUpdater();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Call once on startup.
  useEffect(() => {
    if (checkUpdateOnStartup ?? true) {
      checkForUpdates(false);
    }
  }, []);

  return (
    <Box sx={sx} data-testid="main-content">
      <BookReader sx={{ display: activeView === "reader" ? undefined : "none" }} />
      <Bookshelf sx={{ display: activeView === "bookshelf" ? undefined : "none" }} />
      <UpdaterProgressDialog
        isUpdating={isUpdating}
        updateProgress={updateProgress}
        updateStatus={updateStatus}
      />
      <UpdaterConfirmDialog
        open={confirmDialogOpen}
        update={currentUpdate}
        onConfirm={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />
      <UpdaterMessageDialog
        open={messageDialogOpen}
        title={messageDialogTitle}
        message={messageDialogText}
        isError={messageDialogIsError}
        onClose={closeMessageDialog}
      />
    </Box>
  );
}
