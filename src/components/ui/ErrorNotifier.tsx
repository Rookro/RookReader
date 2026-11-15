import { useEffect } from "react";
import { errorsShown } from "../../store/errorNotificationSlice";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useNotification } from "./Notification/NotificationContext";
import { useErrorMessage } from "./useErrorMessage";

/**
 * Shows the errors the store has collected (`errorNotification`) as notifications, then
 * empties the queue. Renders nothing.
 *
 * Errors that are in the queue together are shown as one notification, each distinct
 * message on its own line. An error queued later gets its own notification, shown after
 * those on screen or waiting, except information notifications, which it removes, or
 * dropped if one of them is an error with the same text.
 */
export default function ErrorNotifier() {
  const errorMessage = useErrorMessage();
  const { showNotification } = useNotification();
  const dispatch = useAppDispatch();
  const pending = useAppSelector((state) => state.errorNotification.pending);

  useEffect(() => {
    if (pending.length === 0) {
      return;
    }
    const messages = pending.map(({ context, code }) => errorMessage(context, code));
    showNotification([...new Set(messages)].join("\n"), "error");
    dispatch(errorsShown());
  }, [pending, errorMessage, showNotification, dispatch]);

  return null;
}
