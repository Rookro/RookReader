import { Box, debounce, SxProps, Theme } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { Allotment } from "allotment";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookshelves } from "../../hooks/useBookshelves";
import { useBookTags } from "../../hooks/useBookTags";
import { addBookshelf, addTag, setGridSize } from "../../reducers/BookCollectionReducer";
import { useAppDispatch } from "../../Store";
import BookGrid from "./BookGrid";
import { CreateBookshelfDialog } from "./Dialog/CreateBookshelfDialog";
import CreateBookTagDialog from "./Dialog/CreateBookTagDialog";
import MenuList from "./MenuList";
import { setActiveView } from "../../reducers/ViewReducer";
import { Book } from "../../types/DatabaseModels";
import { setContainerFilePath, setSortOrder } from "../../reducers/ReadReducer";
import { settingsStore } from "../../settings/SettingsStore";
import { SortOrder } from "../../types/SortOrderType";

/**
 * Props for the Bookshelf component
 */
export interface BookshelfProps {
  /** Sx props for the Bookshelf component */
  sx?: SxProps<Theme>;
}

/** Bookshelf component */
export default function Bookshelf({ sx }: BookshelfProps) {
  useBookshelves();
  useBookTags();
  const dispatch = useAppDispatch();
  const [isBookshelfDialogOpen, setIsBookshelfDialogOpen] = useState(false);
  const [isBookTagDialogOpen, setIsBookTagDialogOpen] = useState(false);

  const handleOpenCreateBookshelfDialog = useCallback(() => setIsBookshelfDialogOpen(true), []);
  const handleCloseCreateBookshelfDialog = useCallback(() => setIsBookshelfDialogOpen(false), []);

  const handleOpenCreateBookTagDialog = useCallback(() => setIsBookTagDialogOpen(true), []);
  const handleCloseCreateBookTagDialog = useCallback(() => setIsBookTagDialogOpen(false), []);

  const paneSizes = useMemo<number[] | undefined>(() => {
    const storedSizes = localStorage.getItem("bookshelf-left-pane-sizes");
    if (storedSizes) {
      try {
        const sizes = JSON.parse(storedSizes);
        if (Array.isArray(sizes) && sizes.every((size) => typeof size === "number")) {
          return sizes;
        }
      } catch (ex) {
        error(`Failed to parse bookshelf-left-pane-sizes: ${ex}`);
      }
    }
    return undefined;
  }, []);

  const handlePaneSizeChanged = useMemo(
    () =>
      debounce((sizes: number[]) => {
        localStorage.setItem("bookshelf-left-pane-sizes", JSON.stringify(sizes));
      }, 500),
    [],
  );

  const handleBookSelected = useCallback(
    (book: Book) => {
      dispatch(setContainerFilePath(book.file_path));
      dispatch(setActiveView("reader"));
    },
    [dispatch],
  );

  const handleCreateBookshelf = useCallback(
    (name: string, icon_id: string) => {
      dispatch(addBookshelf({ name, icon_id }));
    },
    [dispatch],
  );

  const handleCreateBookTag = useCallback(
    (name: string, color_code: string) => {
      dispatch(addTag({ name, color_code }));
    },
    [dispatch],
  );

  useEffect(() => {
    const initBookshelfSettings = async () => {
      const storedSortOrder =
        (await settingsStore.get<SortOrder>("bookshelf-sort-order")) ?? "NAME_ASC";
      dispatch(setSortOrder(storedSortOrder));

      const gridSize = (await settingsStore.get<number>("bookshelf-grid-size")) ?? 1;
      dispatch(setGridSize(gridSize));
    };

    initBookshelfSettings();
  }, [dispatch]);

  return (
    <Box sx={{ width: "100%", height: "100%", ...sx }}>
      <Allotment
        defaultSizes={paneSizes}
        proportionalLayout={false}
        onChange={handlePaneSizeChanged}
      >
        <Allotment.Pane preferredSize={200} minSize={200}>
          <MenuList
            onClickAddBookshelf={handleOpenCreateBookshelfDialog}
            onClickAddBookTag={handleOpenCreateBookTagDialog}
          />
        </Allotment.Pane>
        <Allotment.Pane>
          <Box
            sx={{
              width: "100%",
              height: "100%",
              backgroundColor: (theme) => theme.palette.background.default,
            }}
          >
            <BookGrid onBookSelect={handleBookSelected} />
          </Box>
        </Allotment.Pane>
      </Allotment>
      <CreateBookshelfDialog
        openDialog={isBookshelfDialogOpen}
        onClose={handleCloseCreateBookshelfDialog}
        onCreate={handleCreateBookshelf}
      />
      <CreateBookTagDialog
        openDialog={isBookTagDialogOpen}
        onClose={handleCloseCreateBookTagDialog}
        onCreate={handleCreateBookTag}
      />
    </Box>
  );
}
