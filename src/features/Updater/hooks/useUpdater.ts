import { debug, error } from "@tauri-apps/plugin-log";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { isUpdaterSupported } from "../../../bindings/UpdaterCommands";

/**
 * Global lock to prevent the update dialog from being displayed twice.
 */
let isCheckingGlobal = false;

/**
 * Hook to manage the application updater logic.
 */
export function useUpdater() {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState("");

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [currentUpdate, setCurrentUpdate] = useState<Update | null>(null);

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogTitle, setMessageDialogTitle] = useState("");
  const [messageDialogText, setMessageDialogText] = useState("");
  const [messageDialogIsError, setMessageDialogIsError] = useState(false);

  const showMessage = useCallback((title: string, message: string, isError: boolean = false) => {
    setMessageDialogTitle(title);
    setMessageDialogText(message);
    setMessageDialogIsError(isError);
    setMessageDialogOpen(true);
  }, []);

  const closeMessageDialog = useCallback(() => {
    setMessageDialogOpen(false);
  }, []);

  const checkForUpdates = useCallback(
    async (manualCheck: boolean = false) => {
      if (isCheckingGlobal) {
        debug("Skipping update check because another check is already in progress.");
        return;
      }
      isCheckingGlobal = true;

      try {
        const supported = await isUpdaterSupported();
        if (!supported) {
          if (manualCheck) {
            showMessage(t("updater.dialog-title"), t("updater.unsupported-platform"), false);
          }
          isCheckingGlobal = false;
          return;
        }

        debug("Checking for updates...");
        const update = await check();
        debug(
          `Update check completed. ${update ? `Update available: ${update.version}` : "No update available"}`,
        );

        if (!update) {
          if (manualCheck) {
            showMessage(t("updater.dialog-title"), t("updater.not-available"));
          }
          isCheckingGlobal = false;
          return;
        }

        setCurrentUpdate(update);
        setConfirmDialogOpen(true);
      } catch (e) {
        error(`Failed to check for updates: ${e}`);
        if (manualCheck) {
          showMessage(
            t("updater.dialog-error-title"),
            t("updater.checking-error", { error: String(e) }),
            true,
          );
        }
        isCheckingGlobal = false;
      }
    },
    [showMessage, t],
  );

  const handleConfirmUpdate = useCallback(async () => {
    setConfirmDialogOpen(false);
    if (!currentUpdate) {
      isCheckingGlobal = false;
      return;
    }

    setIsUpdating(true);
    setUpdateStatus(t("updater.downloading", { progress: 0 }));

    try {
      let downloaded = 0;
      let contentLength = 0;

      await currentUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            debug(`Start downloading update...(total: ${contentLength})`);
            setUpdateStatus(t("updater.downloading", { progress: 0 }));
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const percent = Math.round((downloaded / contentLength) * 100);
              debug(`Downloading update... (downloaded: ${downloaded}, progress: ${percent}%)`);
              setUpdateProgress(percent);
              setUpdateStatus(t("updater.downloading", { progress: percent }));
            }
            break;
          case "Finished":
            debug(`Finished installing update`);
            setUpdateStatus(t("updater.installing"));
            break;
        }
      });

      await relaunch();
    } catch (e) {
      error(`Failed to install update: ${e}`);
      showMessage(
        t("updater.dialog-error-title"),
        t("updater.installing-error", { error: String(e) }),
        true,
      );
    } finally {
      setIsUpdating(false);
      setUpdateProgress(0);
      setUpdateStatus("");
      isCheckingGlobal = false;
    }
  }, [t, showMessage, currentUpdate]);

  const handleCancelUpdate = useCallback(() => {
    debug("User cancelled update");
    setConfirmDialogOpen(false);
    isCheckingGlobal = false;
  }, []);

  return {
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
  };
}
