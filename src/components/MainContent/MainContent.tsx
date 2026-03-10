import { Box, SxProps, Theme } from "@mui/material";
import { lazy } from "react";
import { useSettingsChange } from "../../hooks/useSettingsChange";
import { useAppSelector } from "../../Store";

const BookReader = lazy(() => import("../BookReader/BookReader"));
const Bookshelf = lazy(() => import("../Bookshelf/Bookshelf"));

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
  const { activeView } = useAppSelector((state) => state.view);

  return (
    <Box sx={sx}>
      <BookReader sx={{ display: activeView === "reader" ? undefined : "none" }} />
      <Bookshelf sx={{ display: activeView === "bookshelf" ? undefined : "none" }} />
    </Box>
  );
}
