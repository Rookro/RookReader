import { Box, type SxProps, type Theme } from "@mui/material";
import { Allotment } from "allotment";
import { useCallback, useState } from "react";
import type { BookWithState } from "../../../domain/entities";
import { usePaneSizes } from "../../../hooks/usePaneSizes";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { openBook } from "../../BookReader/slice";
import { setActiveView } from "../../MainView/slice";
import { addCollection } from "../slice";
import { addTag } from "../tagSlice";
import BookGrid from "./BookGrid";
import { BookSelectionProvider } from "./BookSelectionContext";
import CreateBookTagDialog from "./Dialog/CreateBookTagDialog";
import { CreateCollectionDialog } from "./Dialog/CreateCollectionDialog";
import MenuList from "./MenuList";

/**
 * Props for the Bookshelf component
 */
export interface BookshelfProps {
  /** Sx props for the Bookshelf component */
  sx?: SxProps<Theme>;
}

/** Bookshelf component */
export default function Bookshelf({ sx }: BookshelfProps) {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector((state) => state.collection.selectedId);
  const bookshelfSortOrder = useAppSelector((state) => state.settings.bookshelf.sortOrder);
  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isBookTagDialogOpen, setIsBookTagDialogOpen] = useState(false);

  const handleOpenCreateCollectionDialog = useCallback(
    () => setIsCreateCollectionDialogOpen(true),
    [],
  );
  const handleCloseCreateCollectionDialog = useCallback(
    () => setIsCreateCollectionDialogOpen(false),
    [],
  );

  const handleOpenCreateBookTagDialog = useCallback(() => setIsBookTagDialogOpen(true), []);
  const handleCloseCreateBookTagDialog = useCallback(() => setIsBookTagDialogOpen(false), []);

  const { paneSizes, setPaneSizes } = usePaneSizes("bookshelf-left-pane-sizes");

  const handleBookSelected = useCallback(
    (book: BookWithState) => {
      dispatch(
        openBook({
          path: book.filePath,
          origin: {
            kind: "bookshelf",
            collectionId: selectedCollectionId,
            sortOrder: bookshelfSortOrder,
          },
        }),
      );
      dispatch(setActiveView("reader"));
    },
    [dispatch, selectedCollectionId, bookshelfSortOrder],
  );

  const handleCreateCollection = useCallback(
    (name: string, iconId: string) => {
      dispatch(addCollection({ name, iconId }));
    },
    [dispatch],
  );

  const handleCreateBookTag = useCallback(
    (name: string, colorCode: string) => {
      dispatch(addTag({ name, colorCode }));
    },
    [dispatch],
  );

  return (
    <Box sx={{ width: "100%", height: "100%", ...sx }} data-testid="bookshelf">
      <Allotment defaultSizes={paneSizes} proportionalLayout={false} onChange={setPaneSizes}>
        <Allotment.Pane preferredSize={200} minSize={200}>
          <MenuList
            onClickAddCollection={handleOpenCreateCollectionDialog}
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
            <BookSelectionProvider>
              <BookGrid onBookSelect={handleBookSelected} />
            </BookSelectionProvider>
          </Box>
        </Allotment.Pane>
      </Allotment>
      <CreateCollectionDialog
        open={isCreateCollectionDialogOpen}
        onClose={handleCloseCreateCollectionDialog}
        onCreate={handleCreateCollection}
      />
      <CreateBookTagDialog
        open={isBookTagDialogOpen}
        onClose={handleCloseCreateBookTagDialog}
        onCreate={handleCreateBookTag}
      />
    </Box>
  );
}
