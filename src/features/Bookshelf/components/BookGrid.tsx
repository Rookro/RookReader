import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid, useGridCallbackRef } from "react-window";
import type { Book, BookWithState } from "../../../domain/book/schema";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { updateSettings } from "../../Settings/slice";
import { useBookSelection } from "../hooks/useBookSelection";
import { type BookshelfDialogType, useBookshelfDialogs } from "../hooks/useBookshelfDialogs";
import { useReadingBookSelection } from "../hooks/useReadingBookSelection";
import { setEditSeriesOrderDialogState, setSearchText, setSelectedSeriesId } from "../slice";
import {
  andSearch,
  andSearchGridItems,
  sortByGridItem,
  sortBySeriesOrder,
} from "../utils/BookshelfUtils";
import BookGridCell, { type BookGridCellProps, type GridItem } from "./BookGridCell";
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
    (state: RootState) => state.bookCollection.bookshelf.books,
    (state: RootState) => state.bookCollection.bookshelf.bookshelves,
    (state: RootState) => state.bookCollection.bookshelf.status,
    (state: RootState) => state.bookCollection.tag.selectedId,
    (state: RootState) => state.bookCollection.tag.tags,
    (state: RootState) => state.bookCollection.series.series,
    (state: RootState) => state.bookCollection.series.selectedId,
    (state: RootState) => state.bookCollection.isEditSeriesOrderDialogOpen,
    (state: RootState) => state.bookCollection.editSeriesOrderTargetId,
    (state: RootState) => state.read.containerFile.book,
    (state: RootState) => state.view.activeView,
  ],
  (
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    status,
    tagId,
    availableTags,
    allSeries,
    selectedSeriesId,
    isEditSeriesOrderDialogOpen,
    editSeriesOrderTargetId,
    readingBook,
    activeView,
  ) => ({
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    status,
    tagId,
    availableTags,
    allSeries,
    selectedSeriesId,
    isEditSeriesOrderDialogOpen,
    editSeriesOrderTargetId,
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
    tagId,
    availableTags,
    allSeries,
    selectedSeriesId,
    isEditSeriesOrderDialogOpen,
    editSeriesOrderTargetId,
    readingBook,
    activeView,
  } = useAppSelector(selectBookGridState);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useResizeObserver(containerRef);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const [grid, setGrid] = useGridCallbackRef(null);
  const [readingBookIndex, setReadingBookIndex] = useState<number>(-1);
  const {
    dialogType,
    selectedBookIds: dialogBookIds,
    selectedBooks: dialogBooks,
    openDialog,
    closeDialog,
  } = useBookshelfDialogs();

  const handleCloseEditSeriesOrderDialog = useCallback(() => {
    dispatch(setEditSeriesOrderDialogState({ isOpen: false, seriesId: null }));
  }, [dispatch]);

  const editSeriesOrderBooks = useMemo(() => {
    if (editSeriesOrderTargetId === null) return [];
    return booksInSelectedBookshelf
      .filter((b) => b.series_id === editSeriesOrderTargetId)
      .sort(sortBySeriesOrder);
  }, [booksInSelectedBookshelf, editSeriesOrderTargetId]);

  const currentGridSize = useMemo(
    () => GRID_SIZES[bookshelfSettings.gridSize],
    [bookshelfSettings.gridSize],
  );

  const filteredSortedItems = useMemo(() => {
    // Filter books based on selected tag
    const taggedBooks =
      tagId === null
        ? booksInSelectedBookshelf
        : booksInSelectedBookshelf.filter((book) => book.tag_ids.includes(tagId));

    // Drill-down mode logic: if a series is selected, show only books in that series
    if (selectedSeriesId !== null) {
      return andSearch(taggedBooks, searchText)
        .filter((book) => book.series_id === selectedSeriesId)
        .sort(sortBySeriesOrder)
        .map((book) => ({ type: "book" as const, data: book }));
    }

    // Main Bookshelf logic: Group books by series_id BEFORE searching
    const seriesMap = new Map<number, BookWithState[]>();
    const standaloneBooks: BookWithState[] = [];

    taggedBooks.forEach((book) => {
      if (book.series_id !== null) {
        if (!seriesMap.has(book.series_id)) {
          seriesMap.set(book.series_id, []);
        }
        seriesMap.get(book.series_id)?.push(book);
      } else {
        standaloneBooks.push(book);
      }
    });

    const groupedItems: GridItem[] = [];

    // Add series items
    seriesMap.forEach((booksInSeries, id) => {
      const seriesObj = allSeries.find((s) => s.id === id);
      if (seriesObj) {
        groupedItems.push({ type: "series", data: seriesObj, books: booksInSeries });
      } else {
        // Fallback for missing series data
        booksInSeries.forEach((book) => {
          standaloneBooks.push(book);
        });
      }
    });

    // Add standalone book items
    standaloneBooks.forEach((book) => {
      groupedItems.push({ type: "book", data: book });
    });

    // Perform search on the grouped items (Search by Series name or Standalone Book name)
    const searchedItems = andSearchGridItems(groupedItems, searchText);

    // Sort the final list
    return searchedItems.sort((a, b) => sortByGridItem(a, b, bookshelfSettings.sortOrder));
  }, [
    booksInSelectedBookshelf,
    tagId,
    searchText,
    selectedSeriesId,
    allSeries,
    bookshelfSettings.sortOrder,
  ]);

  const handleGridSizeChange = useCallback(
    (newValue: number) => {
      const newBookshelfSettings = { ...bookshelfSettings, gridSize: newValue };
      dispatch(updateSettings({ key: "bookshelf", value: newBookshelfSettings }));
    },
    [dispatch, bookshelfSettings],
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
      // For selection logic, we only care about books in the current filtered list
      const booksOnly = filteredSortedItems
        .filter((item): item is { type: "book"; data: BookWithState } => item.type === "book")
        .map((item) => item.data);

      const bookToIdx = new Map<number, number>();
      booksOnly.forEach((b, i) => {
        bookToIdx.set(b.id, i);
      });

      handleSelectionClick(book, e as React.MouseEvent, booksOnly, bookToIdx, onBookSelect);
    },
    [filteredSortedItems, onBookSelect, handleSelectionClick],
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

  useReadingBookSelection(readingBook, filteredSortedItems, setReadingBookIndex);

  // Scroll to make the selected item visible
  useEffect(() => {
    if (filteredSortedItems.length === 0 || !grid) {
      return;
    }

    // Use setTimeout to push the scroll command to the end of the event loop.
    // This ensures that the virtualized list (react-window) has finished
    // rendering and measuring item positions before attempting to scroll.
    const timerId = setTimeout(() => {
      try {
        if (readingBookIndex === -1) {
          debug("Scrolling to top.");
          grid.scrollToCell({
            behavior: "instant",
            columnIndex: 0,
            rowIndex: 0,
          });
        } else {
          debug(`Scrolling to cell ${readingBookIndex}.`);
          grid.scrollToCell({
            behavior: "instant",
            columnAlign: "smart",
            rowAlign: "smart",
            columnIndex: readingBookIndex % columnCount,
            rowIndex: Math.floor(readingBookIndex / columnCount),
          });
        }
      } catch (e) {
        error(`Failed to scroll to cell ${readingBookIndex}: ${e}`);
      }
    }, 20);

    return () => {
      clearTimeout(timerId);
    };
  }, [readingBookIndex, filteredSortedItems, grid, columnCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredSortedItems.length === 0) return;

      let nextIndex = focusedIndex;
      if (e.key === "ArrowRight") {
        nextIndex =
          focusedIndex === -1 ? 0 : Math.min(filteredSortedItems.length - 1, focusedIndex + 1);
      } else if (e.key === "ArrowLeft") {
        nextIndex = focusedIndex === -1 ? 0 : Math.max(0, focusedIndex - 1);
      } else if (e.key === "ArrowDown") {
        nextIndex =
          focusedIndex === -1
            ? 0
            : Math.min(filteredSortedItems.length - 1, focusedIndex + columnCount);
      } else if (e.key === "ArrowUp") {
        nextIndex = focusedIndex === -1 ? 0 : Math.max(0, focusedIndex - columnCount);
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = filteredSortedItems.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        if (focusedIndex >= 0) {
          e.preventDefault();
          const item = filteredSortedItems[focusedIndex];
          if (item.type === "book") {
            handleBookClick(item.data, e);
          } else {
            handleSeriesClick(item.data.id);
          }
        }
        return;
      } else {
        return;
      }

      e.preventDefault();
      setFocusedIndex(nextIndex);
    },
    [focusedIndex, filteredSortedItems, columnCount, handleBookClick, handleSeriesClick],
  );

  const getTargetBooks = useCallback(() => {
    const booksOnly = filteredSortedItems
      .filter((item): item is { type: "book"; data: BookWithState } => item.type === "book")
      .map((item) => item.data);

    return booksOnly.filter((b) => selectedBookIds.has(b.id));
  }, [selectedBookIds, filteredSortedItems]);

  const bookshelfActions = useMemo(
    () => ({
      openDialog: (type: BookshelfDialogType, books: BookWithState[]) => {
        openDialog(type, books);
      },
    }),
    [openDialog],
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
                  // Center the grid horizontally
                  marginLeft: (gridWidth - columnWidth * columnCount) / 2,
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
          onAddToBookshelf={() => openDialog("add-to-bookshelf", getTargetBooks())}
          onSetTags={() => openDialog("set-tags", getTargetBooks())}
          onSetSeries={() => openDialog("set-series", getTargetBooks())}
          onDelete={() => openDialog("delete-books", getTargetBooks())}
        />

        <AddBooksToBookshelvesDialog
          openDialog={dialogType === "add-to-bookshelf"}
          bookIds={dialogBookIds}
          availableBookshelves={availableBookshelves}
          onClose={handleCloseDialog}
          onAddBooks={handleCloseDialog}
        />
        <SetBookTagsDialog
          openDialog={dialogType === "set-tags"}
          bookIds={dialogBookIds}
          availableTags={availableTags}
          onClose={handleCloseDialog}
          onUpdateTags={handleCloseDialog}
        />
        <SetSeriesDialog
          openDialog={dialogType === "set-series"}
          bookIds={dialogBookIds}
          availableSeries={allSeries}
          onClose={handleCloseDialog}
          onUpdateSeries={handleCloseDialog}
        />
        <BookDeleteDialog
          openDialog={dialogType === "delete-books"}
          books={dialogBooks}
          onClose={handleCloseDialog}
        />
        <EditSeriesOrderDialog
          openDialog={isEditSeriesOrderDialogOpen}
          books={editSeriesOrderBooks}
          onClose={handleCloseEditSeriesOrderDialog}
        />
      </Stack>
    </BookshelfActionsContext.Provider>
  );
}
