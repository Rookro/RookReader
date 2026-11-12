import Alert, { type AlertColor } from "@mui/material/Alert";
import Snackbar, { type SnackbarCloseReason } from "@mui/material/Snackbar";
import { error } from "@tauri-apps/plugin-log";
import {
  createContext,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
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
}

/**
 * Interface defining the type of the notification context.
 */
interface NotificationContextType {
  /**
   * Queues a notification. Notifications are shown one at a time, in the order requested;
   * a request that repeats a queued message and severity is dropped.
   */
  showNotification: (message: string, severity?: AlertColor) => void;
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

  const showNotification = useCallback((message: string, severity: AlertColor = "info") => {
    const id = nextId.current++;
    setQueue((queued) =>
      queued.some((n) => n.message === message && n.severity === severity)
        ? queued
        : [...queued, { id, message, severity }],
    );
  }, []);

  const handleClose = useCallback(
    (_e: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
      if (reason === "clickaway" || !current) {
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
          autoHideDuration={AUTO_HIDE_MS}
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
