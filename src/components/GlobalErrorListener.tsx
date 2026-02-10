import { useEffect } from "react";
import { useNotification } from "./Notification/NotificationContext";
import { useAppSelector, useAppDispatch } from "../Store";
import { clearContainerFileError, clearExplorerError } from "../reducers/FileReducer";
import { clearHistoryError } from "../reducers/HistoryReducer";
import { useTranslation } from "react-i18next";
import { ErrorCode } from "../types/Error";

/**
 * A headless component that listens to Redux error states and triggers UI notifications.
 *
 * @remarks
 * This component does not render any DOM elements (`return null`).
 * It must be placed inside the `NotificationProvider` and the Redux `Provider`.
 * It monitors errors in Redux state. When an error is detected:
 * 1. It calls `showNotification` to display the error.
 * 2. It dispatches `clearError` to reset the Redux state, ensuring subsequent errors are caught.
 *
 * @example
 * ```tsx
 * <Provider store={store}>
 *   <NotificationProvider>
 *     <GlobalErrorListener />
 *     <App />
 *   </NotificationProvider>
 * </Provider>
 * ```
 */
export default function GlobalErrorListener() {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const dispatch = useAppDispatch();

  const { error: containerFileError } = useAppSelector((state) => state.file.containerFile);
  const { error: explorerError } = useAppSelector((state) => state.file.explorer);
  const { error: historyError } = useAppSelector((state) => state.history);

  useEffect(() => {
    if (containerFileError) {
      let sub_msg = "";
      if (containerFileError.code === ErrorCode.CONTAINER_UNSUPPORTED_CONTAINER_ERROR) {
        sub_msg = t("error-message.container.unsupported-format");
      } else if (containerFileError.code === ErrorCode.CONTAINER_ENTRY_NOT_FOUND_ERROR) {
        sub_msg = t("error-message.container.entry-not-found");
      }

      const msg = `${t("error-message.common.failed-to-open-container-file")} ${sub_msg}`;
      showNotification(msg, "error");
      dispatch(clearContainerFileError());
    }

    if (explorerError) {
      showNotification(t("error-message.common.failed-to-get-dir-entries"), "error");
      dispatch(clearExplorerError());
    }

    if (historyError) {
      showNotification(t("error-message.common.failed-to-fetch-history"), "error");
      dispatch(clearHistoryError());
    }
  }, [t, dispatch, containerFileError, explorerError, historyError, showNotification]);

  return null;
}
