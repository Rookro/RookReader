import { createContext, useContext, useState, useCallback, ReactNode, SyntheticEvent } from "react";
import Snackbar, { SnackbarCloseReason } from "@mui/material/Snackbar";
import Alert, { AlertColor } from "@mui/material/Alert";
import { error } from "@tauri-apps/plugin-log";

/**
 * Interface defining the type of the notification context.
 */
interface NotificationContextType {
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
 * It renders the `Snackbar` component at the root level.
 *
 * @param props The provider props.
 * @returns The provider component with the global Snackbar.
 */
export default function NotificationProvider({ children }: NotificationProviderProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AlertColor>("info");

  const showNotification = useCallback((msg: string, type: AlertColor = "info") => {
    setMessage(msg);
    setSeverity(type);
    setOpen(true);
  }, []);

  const handleClose = (_e: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ maxWidth: "50%" }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          sx={{ width: "100%", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}
