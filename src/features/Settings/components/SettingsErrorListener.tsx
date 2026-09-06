import { useEffect } from "react";
import { useNotification } from "../../../components/ui/Notification/NotificationContext";
import { useErrorMessage } from "../../../components/ui/useErrorMessage";
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
  const errorMessage = useErrorMessage();
  const { showNotification } = useNotification();
  const dispatch = useAppDispatch();
  const settingsError = useAppSelector((state) => state.settingsError.error);

  useEffect(() => {
    if (settingsError) {
      showNotification(errorMessage("settings-save", settingsError.code), "error");
      dispatch(clearSettingsError());
    }
  }, [settingsError, errorMessage, showNotification, dispatch]);

  return null;
}
