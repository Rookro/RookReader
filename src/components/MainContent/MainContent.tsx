import { Box, SxProps, Theme } from "@mui/material";
import { lazy, useEffect } from "react";
import { useSettingsChange } from "../../hooks/useSettingsChange";
import { useAppDispatch, useAppSelector } from "../../Store";
import { setActiveView } from "../../reducers/ViewReducer";
import { settingsStore } from "../../settings/SettingsStore";

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
  const dispatch = useAppDispatch();
  const { activeView } = useAppSelector((state) => state.view);

  useEffect(() => {
    const initView = async () => {
      const initialView = await settingsStore.get<string>("initial-view");
      if (initialView === "reader" || initialView === "bookshelf") {
        dispatch(setActiveView(initialView));
      }
    };
    initView();
  }, [dispatch]);

  return (
    <Box sx={sx} data-testid="main-content">
      <BookReader sx={{ display: activeView === "reader" ? undefined : "none" }} />
      <Bookshelf sx={{ display: activeView === "bookshelf" ? undefined : "none" }} />
    </Box>
  );
}
