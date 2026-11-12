import Alert, { type AlertColor } from "@mui/material/Alert";
import Snackbar, { type SnackbarCloseReason } from "@mui/material/Snackbar";
import { error } from "@tauri-apps/plugin-log";
import {
  createContext,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** How long a notification stays on screen before it closes by itself. */
const AUTO_HIDE_MS = 5000;

/** A notification on screen or waiting for its turn. */
interface QueuedNotification {
  /** Tells one notification from the next, so each gets its own snackbar and timer. */
  id: number;
  message: string;
  severity: AlertColor;
  /** Closes only with its close button: not by itself, not on Escape. */
  persist: boolean;
}

/** How a notification is shown. */
export interface NotificationOptions {
  /**
   * Keep the notification on screen until its close button is pressed: it does not close by
   * itself or on Escape. Defaults to false.
   */
  persist?: boolean;
}

/**
 * Interface defining the type of the notification context.
 */
interface NotificationContextType {
  /**
   * Queues a notification. Notifications are shown one at a time, in the order requested;
   * a request that repeats a queued message and severity is dropped. An error removes the
   * information notifications requested before it: the one on screen closes and those
   * waiting are dropped.
   */
  showNotification: (message: string, severity?: AlertColor, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Custom hook to access the notification system.
 *
 * @returns The notification context containing the `showNotification` function.
 * @throws {Error} If used outside of a {@link NotificationProvider}.
 */
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    error("useNotification must be used within a NotificationProvider.");
    throw new Error("useNotification must be used within a NotificationProvider.");
  }
  return context;
};

/**
 * Props for the NotificationProvider component.
 */
interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * A provider component that wraps the application (or a part of it) to enable global notifications.
 * It renders the `Snackbar` component at the root level, one notification at a time.
 *
 * @param props The provider props.
 * @returns The provider component with the global Snackbar.
 */
export default function NotificationProvider({ children }: NotificationProviderProps) {
  // The first entry is on screen; the rest wait for it to leave.
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  // The notification that was told to close and is still leaving the screen.
  const [closingId, setClosingId] = useState<number | null>(null);
  const nextId = useRef(0);

  const current = queue[0];

  const showNotification = useCallback(
    (message: string, severity: AlertColor = "info", options?: NotificationOptions) => {
      const id = nextId.current++;
      const persist = options?.persist ?? false;
      setQueue((queued) => {
        if (queued.some((n) => n.message === message && n.severity === severity)) {
          return queued;
        }
        // The one on screen stays so that it can leave through its exit transition.
        const kept =
          severity === "error" ? queued.filter((n, i) => i === 0 || n.severity !== "info") : queued;
        return [...kept, { id, message, severity, persist }];
      });
    },
    [],
  );

  // An information notification on screen with an error waiting was requested before it.
  useEffect(() => {
    if (current?.severity === "info" && queue.some((n) => n.severity === "error")) {
      setClosingId(current.id);
    }
  }, [current, queue]);

  const handleClose = useCallback(
    (_e: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
      if (reason === "clickaway" || !current) {
        return;
      }
      // A persistent notification closes only with its close button.
      if (current.persist && reason === "escapeKeyDown") {
        return;
      }
      setClosingId(current.id);
    },
    [current],
  );

  // The closed notification has left the screen; the next one takes its place.
  const handleExited = useCallback(() => {
    setQueue((queued) => queued.slice(1));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {current && (
        <Snackbar
          key={current.id}
          open={current.id !== closingId}
          autoHideDuration={current.persist ? null : AUTO_HIDE_MS}
          onClose={handleClose}
          slotProps={{ transition: { onExited: handleExited } }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{ maxWidth: "50%" }}
        >
          <Alert
            onClose={handleClose}
            severity={current.severity}
            variant="filled"
            sx={{ width: "100%", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
          >
            {current.message}
          </Alert>
        </Snackbar>
      )}
    </NotificationContext.Provider>
  );
}
