import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { errorCodeToMessageKey } from "../../../components/ui/errorMessages";
import { useNotification } from "../../../components/ui/Notification/NotificationContext";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { clearSettingsError } from "../errorSlice";

/**
 * A headless component (mounted in the settings window) that turns a rejected
 * `updateSettings` into a user-facing notification, then clears the stored error.
 *
 * @remarks
 * Settings are validated in Rust (`garde`); a failed `set_settings` rejects the
 * `updateSettings` thunk, which the `settingsError` slice records. This listener
 * observes that error and shows it. It renders nothing.
 */
export default function SettingsErrorListener() {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const dispatch = useAppDispatch();
  const settingsError = useAppSelector((state) => state.settingsError.error);

  useEffect(() => {
    if (settingsError) {
      showNotification(t(errorCodeToMessageKey(settingsError.code)), "error");
      dispatch(clearSettingsError());
    }
  }, [settingsError, t, showNotification, dispatch]);

  return null;
}
