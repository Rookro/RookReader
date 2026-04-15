import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { clearContainerFileError, clearExplorerError } from "../../features/BookReader/slice";
import { clearBookshelfError, clearTagError } from "../../features/Bookshelf/slice";
import { clearHistoryError } from "../../features/History/slice";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { ErrorCode } from "../../types/Error";
import { useNotification } from "./Notification/NotificationContext";

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

  const containerFileError = useAppSelector((state) => state.read.containerFile.error);
  const explorerError = useAppSelector((state) => state.read.explorer.error);
  const historyError = useAppSelector((state) => state.history.error);
  const bookshelfError = useAppSelector((state) => state.bookCollection.bookshelf.error);
  const tagsError = useAppSelector((state) => state.bookCollection.tag.error);

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

    if (bookshelfError) {
      // TODO(Rookro): Show appropriate error message according to the error code
      showNotification(t("error-message.common.bookshelf-error"), "error");
      dispatch(clearBookshelfError());
    }

    if (tagsError) {
      // TODO(Rookro): Show appropriate error message according to the error code
      showNotification(t("error-message.common.tag-error"), "error");
      dispatch(clearTagError());
    }
  }, [
    t,
    dispatch,
    showNotification,
    containerFileError,
    explorerError,
    historyError,
    bookshelfError,
    tagsError,
  ]);

  return null;
}
