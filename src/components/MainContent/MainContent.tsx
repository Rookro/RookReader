import { Box, SxProps, Theme } from "@mui/material";
import { lazy } from "react";
import { useSettingsChange } from "../../hooks/useSettingsChange";

const BookReader = lazy(() => import("../BookReader/BookReader"));

/**
 * Props for the main content component
 */
export interface MainContentProps {
  /** Styles for the main content component */
  sx?: SxProps<Theme>;
}

/**
 * Main content component
 */
export default function MainContent({ sx }: MainContentProps) {
  useSettingsChange();

  return (
    <Box sx={sx}>
      <BookReader />
    </Box>
  );
}
