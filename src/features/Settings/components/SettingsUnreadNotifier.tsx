import { error } from "@tauri-apps/plugin-log";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../../bindings/api";
import { useNotification } from "../../../components/ui/Notification/NotificationContext";

/**
 * Tells the reader, once per page load, that start-up could not read the settings file: the
 * session runs on the default settings with reading history off. Renders nothing.
 */
export default function SettingsUnreadNotifier() {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  // The effect runs again when the language changes; the question is asked once.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) {
      return;
    }
    asked.current = true;
    api.isSettingsUnread().then(
      (unread) => {
        if (unread) {
          showNotification(t("settings.file-unreadable"), "warning", { persist: true });
        }
      },
      (e) => {
        error(`Failed to ask whether the settings file was read: ${e}`);
      },
    );
  }, [showNotification, t]);

  return null;
}
