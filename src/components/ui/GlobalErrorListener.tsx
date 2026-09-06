import { useEffect } from "react";
import {
  clearBookRecordError,
  clearContainerFileError,
  clearExplorerError,
} from "../../features/BookReader/slice";
import { clearBookshelfError } from "../../features/Bookshelf/slice";
import { clearTagError } from "../../features/Bookshelf/tagSlice";
import { clearHistoryError } from "../../features/History/slice";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useNotification } from "./Notification/NotificationContext";
import { useErrorMessage } from "./useErrorMessage";

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
  const errorMessage = useErrorMessage();
  const { showNotification } = useNotification();
  const dispatch = useAppDispatch();

  const containerFileError = useAppSelector((state) => state.read.containerFile.error);
  const bookRecordError = useAppSelector((state) => state.read.containerFile.bookRecordError);
  const explorerError = useAppSelector((state) => state.read.explorer.error);
  const historyError = useAppSelector((state) => state.history.error);
  const bookshelfError = useAppSelector((state) => state.bookCollection.error);
  const tagsError = useAppSelector((state) => state.tag.error);

  useEffect(() => {
    if (containerFileError) {
      showNotification(errorMessage("open-container", containerFileError.code), "error");
      dispatch(clearContainerFileError());
    }

    if (bookRecordError) {
      showNotification(errorMessage("record-book", bookRecordError.code), "error");
      dispatch(clearBookRecordError());
    }

    if (explorerError) {
      showNotification(errorMessage("explorer", explorerError.code), "error");
      dispatch(clearExplorerError());
    }

    if (historyError) {
      showNotification(errorMessage("history", historyError.code), "error");
      dispatch(clearHistoryError());
    }

    if (bookshelfError) {
      showNotification(errorMessage("bookshelf", bookshelfError.code), "error");
      dispatch(clearBookshelfError());
    }

    if (tagsError) {
      showNotification(errorMessage("tag", tagsError.code), "error");
      dispatch(clearTagError());
    }
  }, [
    errorMessage,
    dispatch,
    showNotification,
    containerFileError,
    bookRecordError,
    explorerError,
    historyError,
    bookshelfError,
    tagsError,
  ]);

  return null;
}
