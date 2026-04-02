import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Link, Stack, Typography } from "@mui/material";
import { GitHub, SystemUpdateAlt } from "@mui/icons-material";
import { getName, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { error } from "@tauri-apps/plugin-log";
import appIcon from "../../../../../assets/app-icon.png";
import { useUpdater } from "../../../../Updater/hooks/useUpdater";
import UpdaterProgressDialog from "../../../../../features/Updater/components/UpdaterProgressDialog";
import UpdaterConfirmDialog from "../../../../../features/Updater/components/UpdaterConfirmDialog";
import UpdaterMessageDialog from "../../../../../features/Updater/components/UpdaterMessageDialog";

/**
 * About component.
 */
export default function About() {
  const { t } = useTranslation();
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
  const [isChecking, setIsChecking] = useState(false);

  const [appName, setAppName] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const projectUrl = "https://github.com/Rookro/RookReader";

  useEffect(() => {
    const fetchAppInfo = async () => {
      const appName = await getName();
      setAppName(appName);
      const appVersion = await getVersion();
      setAppVersion(appVersion);
    };
    fetchAppInfo();
  }, []);

  const handleLinkClick = useCallback(async (_e: React.MouseEvent) => {
    try {
      await openUrl(projectUrl);
    } catch (e) {
      error(`Failed to open the project page: ${e}`);
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setIsChecking(true);
    await checkForUpdates(true);
    setIsChecking(false);
  }, [checkForUpdates]);

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Box component="img" src={appIcon} sx={{ width: "100px" }} />
      <Stack direction="column" spacing={1}>
        <Typography variant="h3">{appName}</Typography>
        <Stack direction="row" spacing={2}>
          <Typography variant="h5">version {appVersion}</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SystemUpdateAlt />}
            onClick={handleCheckUpdate}
            disabled={isChecking}
          >
            {isChecking ? t("settings.about.updater.checking") : t("settings.about.updater.check")}
          </Button>
        </Stack>
        <Link
          component="button"
          variant="body1"
          onClick={handleLinkClick}
          sx={{ width: "fit-content" }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ marginBottom: 1 }}>
            <GitHub fontSize="small" />
            <Typography variant="body1">{t("settings.about.project-page")}</Typography>
          </Stack>
        </Link>
      </Stack>
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
    </Stack>
  );
}
