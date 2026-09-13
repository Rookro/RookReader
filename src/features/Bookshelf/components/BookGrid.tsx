import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Grid, useGridCallbackRef } from "react-window";
import type { Book, BookWithState } from "../../../domain/book/schema";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { updateSettings } from "../../Settings/slice";
import { useBookSelection } from "../hooks/useBookSelection";
import { useBookshelfDialogs } from "../hooks/useBookshelfDialogs";
import { useGridKeyboardNavigation } from "../hooks/useGridKeyboardNavigation";
import { useReadingBookIndex } from "../hooks/useReadingBookIndex";
import { useScrollToReadingBook } from "../hooks/useScrollToReadingBook";
import { selectGridItems } from "../selectors";
import { setSelectedSeriesId } from "../seriesSlice";
import { setSearchText } from "../slice";
import { sortBySeriesOrder } from "../utils/BookshelfUtils";
import BookGridCell, { type BookGridCellProps } from "./BookGridCell";
import { BookshelfActionsContext } from "./BookshelfActionsContext";
import AddBooksToBookshelvesDialog from "./Dialog/AddBooksToBookshelvesDialog";
import BookDeleteDialog from "./Dialog/BookDeleteDialog";
import EditSeriesOrderDialog from "./Dialog/EditSeriesOrderDialog";
import SetBookTagsDialog from "./Dialog/SetBookTagsDialog";
import SetSeriesDialog from "./Dialog/SetSeriesDialog";
import FloatingActionBar from "./FloatingActionBar";
import GridSizeControl from "./GridSizeControl";
import NavigationBar from "./NavigationBar";

const GRID_SIZES = [
  { width: 140, height: 220 },
  { width: 190, height: 300 },
  { width: 240, height: 380 },
];

const selectBookGridState = createSelector(
  [
    (state: RootState) => state.settings.bookshelf,
    (state: RootState) => state.bookCollection.searchText,
    (state: RootState) => state.bookCollection.books,
    (state: RootState) => state.bookCollection.bookshelves,
    (state: RootState) => state.bookCollection.status,
    (state: RootState) => state.tag.tags,
    (state: RootState) => state.series.series,
    (state: RootState) => state.read.containerFile.book,
    (state: RootState) => state.view.activeView,
  ],
  (
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    status,
    availableTags,
    allSeries,
    readingBook,
    activeView,
  ) => ({
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    status,
    availableTags,
    allSeries,
    readingBook,
    activeView,
  }),
);

/** Props for the Book grid component */
export interface BookGridProps {
  /** Callback for when a book is selected */
  onBookSelect?: (book: Book) => void;
}

/** Book grid component */
export default function BookGrid({ onBookSelect }: BookGridProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { selectedBookIds, clearSelection, handleSelectionClick } = useBookSelection();

  const {
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    status,
    availableTags,
    allSeries,
    readingBook,
    activeView,
  } = useAppSelector(selectBookGridState);
  const filteredSortedItems = useAppSelector(selectGridItems);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useResizeObserver(containerRef);

  const [grid, setGrid] = useGridCallbackRef(null);
  const {
    dialogType,
    dialogBooks,
    dialogBookIds,
    editSeriesOrderSeriesId,
    openDialog,
    openEditSeriesOrderDialog,
    closeDialog,
  } = useBookshelfDialogs();

  const editSeriesOrderBooks = useMemo(() => {
    if (editSeriesOrderSeriesId === null) return [];
    return booksInSelectedBookshelf
      .filter((b) => b.series_id === editSeriesOrderSeriesId)
      .sort(sortBySeriesOrder);
  }, [booksInSelectedBookshelf, editSeriesOrderSeriesId]);

  const currentGridSize = useMemo(
    () => GRID_SIZES[bookshelfSettings.gridSize],
    [bookshelfSettings.gridSize],
  );

  const allBooks = useMemo(() => {
    return filteredSortedItems
      .filter((item): item is { type: "book"; data: BookWithState } => item.type === "book")
      .map((item) => item.data);
  }, [filteredSortedItems]);

  const handleGridSizeChange = useCallback(
    (newValue: number) => {
      dispatch(updateSettings({ key: "bookshelf", value: { gridSize: newValue } }));
    },
    [dispatch],
  );

  const handleCloseDialog = useCallback(() => {
    closeDialog();
    clearSelection();
  }, [closeDialog, clearSelection]);

  useEffect(() => {
    if (activeView === "bookshelf") {
      clearSelection();
    }
  }, [activeView, clearSelection]);

  const handleBookClick = useCallback(
    (book: BookWithState, e: React.MouseEvent | React.KeyboardEvent) => {
      handleSelectionClick(book, e as React.MouseEvent, allBooks, onBookSelect);
    },
    [allBooks, onBookSelect, handleSelectionClick],
  );

  const handleSeriesClick = useCallback(
    (seriesId: number) => {
      dispatch(setSelectedSeriesId(seriesId));
      dispatch(setSearchText(""));
    },
    [dispatch],
  );

  const columnWidth = currentGridSize.width;
  const rowHeight = currentGridSize.height;

  const theme = useAppTheme();

  const gridWidth = Math.max(containerWidth - theme.customScrollbar.width, 0);

  const columnCount = gridWidth > 0 ? Math.max(1, Math.floor(gridWidth / columnWidth)) : 1;
  const rowCount =
    filteredSortedItems.length === 0 ? 0 : Math.ceil(filteredSortedItems.length / columnCount);

  // Offset used to center the cells horizontally. Applied per cell (via the cell
  // style) rather than as padding/margin on the Grid, because react-window's
  // cells are absolutely positioned and the scroll container must stay full
  // width so the wheel scrolls everywhere, including the empty side strips.
  const horizontalOffset = Math.max((gridWidth - columnWidth * columnCount) / 2, 0);

  const readingBookIndex = useReadingBookIndex(readingBook, filteredSortedItems);
  useScrollToReadingBook({
    grid,
    items: filteredSortedItems,
    readingBook,
    readingBookIndex,
    columnCount,
    gridWidth,
    activeView,
  });

  const { focusedIndex, handleKeyDown } = useGridKeyboardNavigation({
    items: filteredSortedItems,
    columnCount,
    onBookActivate: handleBookClick,
    onSeriesActivate: handleSeriesClick,
  });

  const getSelectedBooks = useCallback(
    () => allBooks.filter((b) => selectedBookIds.has(b.id)),
    [selectedBookIds, allBooks],
  );

  const bookshelfActions = useMemo(
    () => ({ openDialog, openEditSeriesOrderDialog, getSelectedBooks }),
    [openDialog, openEditSeriesOrderDialog, getSelectedBooks],
  );

  const cellProps: BookGridCellProps = useMemo(
    () => ({
      items: filteredSortedItems,
      tags: availableTags,
      size: (bookshelfSettings.gridSize === 0 ? "small" : "medium") as "small" | "medium",
      columnCount,
      onBookClick: handleBookClick,
      onSeriesClick: handleSeriesClick,
      enableAutoScroll: bookshelfSettings.enableAutoScroll,
      focusedIndex,
      readingBookIndex,
      horizontalOffset,
    }),
    [
      filteredSortedItems,
      availableTags,
      bookshelfSettings.gridSize,
      columnCount,
      handleBookClick,
      handleSeriesClick,
      bookshelfSettings.enableAutoScroll,
      focusedIndex,
      readingBookIndex,
      horizontalOffset,
    ],
  );

  return (
    <BookshelfActionsContext.Provider value={bookshelfActions}>
      <Stack
        sx={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        <NavigationBar />

        <Box
          ref={containerRef}
          data-testid="book-grid-container"
          aria-label="book-grid-container"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          sx={{
            width: "100%",
            height: "100%",
            overflow: "auto",
            "&:focus": {
              outline: "none",
            },
          }}
        >
          {status === "loading" ? (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : filteredSortedItems.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                paddingX: 2,
              }}
            >
              {searchText ? (
                <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                  {t("bookshelf.no-search-results", { searchText })}
                </Typography>
              ) : (
                <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                  {t("bookshelf.no-books")}
                </Typography>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
              }}
            >
              <Grid
                gridRef={setGrid}
                cellComponent={BookGridCell}
                columnCount={columnCount}
                columnWidth={columnWidth}
                rowCount={rowCount}
                rowHeight={rowHeight}
                cellProps={cellProps}
                overscanCount={2}
                style={{
                  // Prevent overlap with bottom floating buttons and action bar
                  paddingBottom: "60px",
                }}
              />
            </Box>
          )}
        </Box>

        {/* Grid Size Control */}
        <GridSizeControl value={bookshelfSettings.gridSize} onChange={handleGridSizeChange} />

        {/* Floating Action Bar for Selection */}
        <FloatingActionBar
          selectionCount={selectedBookIds.size}
          onClear={clearSelection}
          onAddToBookshelf={() => openDialog("add-to-bookshelf", getSelectedBooks())}
          onSetTags={() => openDialog("set-tags", getSelectedBooks())}
          onSetSeries={() => openDialog("set-series", getSelectedBooks())}
          onDelete={() => openDialog("delete-books", getSelectedBooks())}
        />

        <AddBooksToBookshelvesDialog
          openDialog={dialogType === "add-to-bookshelf"}
          bookIds={dialogBookIds}
          availableBookshelves={availableBookshelves}
          onClose={handleCloseDialog}
        />
        <SetBookTagsDialog
          openDialog={dialogType === "set-tags"}
          bookIds={dialogBookIds}
          availableTags={availableTags}
          onClose={handleCloseDialog}
        />
        <SetSeriesDialog
          openDialog={dialogType === "set-series"}
          bookIds={dialogBookIds}
          availableSeries={allSeries}
          onClose={handleCloseDialog}
        />
        <BookDeleteDialog
          openDialog={dialogType === "delete-books"}
          books={dialogBooks}
          onClose={handleCloseDialog}
        />
        <EditSeriesOrderDialog
          openDialog={dialogType === "edit-series-order"}
          books={editSeriesOrderBooks}
          onClose={closeDialog}
        />
      </Stack>
    </BookshelfActionsContext.Provider>
  );
}
