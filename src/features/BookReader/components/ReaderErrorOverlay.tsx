import { Alert, Box } from "@mui/material";
import type { ErrorContext } from "../../../components/ui/errorMessages";
import { useErrorMessage } from "../../../components/ui/useErrorMessage";
import type { ErrorCode } from "../../../types/Error";

/** Props for the ReaderErrorOverlay component. */
export interface ReaderErrorOverlayProps {
  /** The operation that failed. */
  context: ErrorContext;
  /** The backend error code describing why it failed. */
  code: ErrorCode;
}

/**
 * States, over the reading area, why nothing could be drawn there.
 *
 * A notification would be gone in five seconds and would leave the reader looking at a
 * blank page with no way to ask what happened, so the reason stays on screen until the
 * reader turns to another page. Clicks pass through it, so the page turn that dismisses
 * it works anywhere on the reader.
 *
 * @param props See {@link ReaderErrorOverlayProps}.
 * @returns The overlay.
 */
export default function ReaderErrorOverlay({ context, code }: ReaderErrorOverlayProps) {
  const errorMessage = useErrorMessage();

  return (
    <Box
      data-testid="reader-error-overlay"
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
        pointerEvents: "none",
        p: 2,
      }}
    >
      <Alert severity="error" variant="outlined" sx={{ maxWidth: "80%" }}>
        {errorMessage(context, code)}
      </Alert>
    </Box>
  );
}
