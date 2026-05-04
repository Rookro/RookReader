import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "react-window";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import type { Book, BookWithState } from "../../../types/DatabaseModels";
import { updateSettings } from "../../Settings/slice";
import { useBookSelection } from "../hooks/useBookSelection";
import { type BookshelfDialogType, useBookshelfDialogs } from "../hooks/useBookshelfDialogs";
import { fetchBooksInSelectedBookshelf, fetchSeries, setSelectedSeriesId } from "../slice";
import { andSearch, sortBy, sortByGridItem } from "../utils/BookshelfUtils";
import BookGridCell, { type BookGridCellProps, type GridItem } from "./BookGridCell";
import { BookshelfActionsContext } from "./BookshelfActionsContext";
import AddBooksToBookshelvesDialog from "./Dialog/AddBooksToBookshelvesDialog";
import BookDeleteDialog from "./Dialog/BookDeleteDialog";
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
    (state: RootState) => state.bookCollection.bookshelf.selectedId,
    (state: RootState) => state.bookCollection.bookshelf.status,
    (state: RootState) => state.bookCollection.tag.selectedId,
    (state: RootState) => state.bookCollection.tag.tags,
    (state: RootState) => state.bookCollection.series.series,
    (state: RootState) => state.bookCollection.series.selectedId,
    (state: RootState) => state.view.activeView,
  ],
  (
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    bookshelfId,
    status,
    tagId,
    availableTags,
    allSeries,
    selectedSeriesId,
    activeView,
  ) => ({
    bookshelfSettings,
    searchText,
    booksInSelectedBookshelf,
    availableBookshelves,
    bookshelfId,
    status,
    tagId,
    availableTags,
    allSeries,
    selectedSeriesId,
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
    bookshelfId,
    status,
    tagId,
    availableTags,
    allSeries,
    selectedSeriesId,
    activeView,
  } = useAppSelector(selectBookGridState);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useResizeObserver(containerRef);

  const {
    dialogType,
    selectedBookIds: dialogBookIds,
    selectedBooks: dialogBooks,
    openDialog,
    closeDialog,
  } = useBookshelfDialogs();

  const currentGridSize = useMemo(
    () => GRID_SIZES[bookshelfSettings.gridSize],
    [bookshelfSettings.gridSize],
  );

  const filteredSortedItems = useMemo(() => {
    // 1. Filter books based on selected tag
    const books =
      tagId === null
        ? booksInSelectedBookshelf
        : booksInSelectedBookshelf.filter((book) =>
            book.tag_ids_str?.split(",").includes(tagId.toString()),
          );

    // 2. Perform search
    const searchedBooks = andSearch(books, searchText);

    // 3. Drill-down: if a series is selected, show only books in that series
    if (selectedSeriesId !== null) {
      return searchedBooks
        .filter((book) => book.series_id === selectedSeriesId)
        .sort((a, b) => sortBy(a, b, bookshelfSettings.sortOrder))
        .map((book) => ({ type: "book" as const, data: book }));
    }

    // 4. Grouping: Group books by series_id if not in drill-down mode
    const groupedItems: GridItem[] = [];
    const seriesMap = new Map<number, BookWithState[]>();
    const standaloneBooks: BookWithState[] = [];

    searchedBooks.forEach((book) => {
      if (book.series_id !== null) {
        if (!seriesMap.has(book.series_id)) {
          seriesMap.set(book.series_id, []);
        }
        seriesMap.get(book.series_id)?.push(book);
      } else {
        standaloneBooks.push(book);
      }
    });

    // Add series items
    seriesMap.forEach((booksInSeries, id) => {
      const series = allSeries.find((s) => s.id === id);
      if (series) {
        groupedItems.push({ type: "series", data: series, books: booksInSeries });
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

    // 5. Sort the final list of items (series and standalone books mixed)
    return groupedItems.sort((a, b) => sortByGridItem(a, b, bookshelfSettings.sortOrder));
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

  const refreshBookshelf = useCallback(() => {
    dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
  }, [dispatch, bookshelfId]);

  const refreshSeries = useCallback(() => {
    dispatch(fetchSeries());
    dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
  }, [dispatch, bookshelfId]);

  useEffect(() => {
    if (activeView === "bookshelf") {
      dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
      dispatch(fetchSeries());
      clearSelection();
    }
  }, [dispatch, bookshelfId, activeView, clearSelection]);

  const handleBookClick = useCallback(
    (book: BookWithState, e: React.MouseEvent) => {
      // For selection logic, we only care about books in the current filtered list
      const booksOnly = filteredSortedItems
        .filter((item): item is { type: "book"; data: BookWithState } => item.type === "book")
        .map((item) => item.data);

      const bookToIdx = new Map<number, number>();
      booksOnly.forEach((b, i) => {
        bookToIdx.set(b.id, i);
      });

      handleSelectionClick(book, e, booksOnly, bookToIdx, onBookSelect);
    },
    [filteredSortedItems, onBookSelect, handleSelectionClick],
  );

  const handleSeriesClick = useCallback(
    (seriesId: number) => {
      dispatch(setSelectedSeriesId(seriesId));
    },
    [dispatch],
  );

  const getTargetBooks = useCallback(
    (book?: BookWithState) => {
      const booksOnly = filteredSortedItems
        .filter((item): item is { type: "book"; data: BookWithState } => item.type === "book")
        .map((item) => item.data);

      return book
        ? selectedBookIds.has(book.id)
          ? booksOnly.filter((b) => selectedBookIds.has(b.id))
          : [book]
        : booksOnly.filter((b) => selectedBookIds.has(b.id));
    },
    [selectedBookIds, filteredSortedItems],
  );

  const bookshelfActions = useMemo(
    () => ({
      openDialog: (type: BookshelfDialogType, books: BookWithState[]) => {
        openDialog(type, books);
      },
      refreshBookshelf,
      refreshSeries,
    }),
    [openDialog, refreshBookshelf, refreshSeries],
  );

  const columnWidth = currentGridSize.width;
  const rowHeight = currentGridSize.height;

  const columnCount =
    containerWidth > 0 ? Math.max(1, Math.floor(containerWidth / columnWidth)) : 1;
  const rowCount =
    filteredSortedItems.length === 0 ? 0 : Math.ceil(filteredSortedItems.length / columnCount);

  const cellProps: BookGridCellProps = useMemo(
    () => ({
      items: filteredSortedItems,
      tags: availableTags,
      size: (bookshelfSettings.gridSize === 0 ? "small" : "medium") as "small" | "medium",
      columnCount,
      onBookClick: handleBookClick,
      onSeriesClick: handleSeriesClick,
      enableAutoScroll: bookshelfSettings.enableAutoScroll,
    }),
    [
      filteredSortedItems,
      availableTags,
      bookshelfSettings.gridSize,
      columnCount,
      handleBookClick,
      handleSeriesClick,
      bookshelfSettings.enableAutoScroll,
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
          sx={{
            width: "100%",
            height: "100%",
            overflow: "auto",
            scrollbarGutter: "stable",
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
                width: columnCount * columnWidth,
                margin: "0 auto",
                // Prevent overlap with bottom floating buttons and action bar
                paddingBottom: "60px",
              }}
            >
              <Grid
                cellComponent={BookGridCell}
                columnCount={columnCount}
                columnWidth={columnWidth}
                rowCount={rowCount}
                rowHeight={rowHeight}
                cellProps={cellProps}
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
          onDelete={() => openDialog("delete-books", getTargetBooks())}
        />

        <AddBooksToBookshelvesDialog
          openDialog={dialogType === "add-to-bookshelf"}
          bookIds={dialogBookIds}
          availableBookshelves={availableBookshelves}
          onClose={handleCloseDialog}
          onAddBooks={refreshBookshelf}
        />
        <SetBookTagsDialog
          openDialog={dialogType === "set-tags"}
          bookIds={dialogBookIds}
          availableTags={availableTags}
          onClose={handleCloseDialog}
          onUpdateTags={refreshBookshelf}
        />
        <SetSeriesDialog
          openDialog={dialogType === "set-series"}
          bookIds={dialogBookIds}
          availableSeries={allSeries}
          onClose={handleCloseDialog}
          onUpdateSeries={refreshSeries}
        />
        <BookDeleteDialog
          openDialog={dialogType === "delete-books"}
          books={dialogBooks}
          onClose={handleCloseDialog}
        />
      </Stack>
    </BookshelfActionsContext.Provider>
  );
}
