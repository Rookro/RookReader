import { Alert, Box } from "@mui/material";
import { useErrorMessage } from "../../../components/ui/useErrorMessage";
import type { ErrorCode } from "../../../types/Error";

/** Props for the PageErrorMessage component. */
export interface PageErrorMessageProps {
  /** The backend error code describing why the page could not be loaded. */
  code: ErrorCode;
  /** How much of the reader the page would have filled: half of a spread, or all of it. */
  width: string;
}

/**
 * Fills a page's own place with the reason that page is not there.
 *
 * Standing where the page would have been is what tells the reader *which* page failed:
 * in a spread, the facing page is still on screen beside it, and two failures read as
 * two failed pages rather than one damaged book. Clicks pass through, so the page turn
 * that leaves the failure behind works anywhere on the reader.
 *
 * @param props See {@link PageErrorMessageProps}.
 * @returns The message, sized to the page it replaces.
 */
export default function PageErrorMessage({ code, width }: PageErrorMessageProps) {
  const errorMessage = useErrorMessage();

  return (
    <Box
      data-testid="page-error-message"
      sx={{
        width,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        p: 2,
      }}
    >
      <Alert severity="error" variant="outlined">
        {errorMessage("load-page", code)}
      </Alert>
    </Box>
  );
}
