import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "react-window";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import type { Book, BookWithState } from "../../../types/DatabaseModels";
import { updateSettings } from "../../Settings/slice";
import { useBookSelection } from "../hooks/useBookSelection";
import { useBookshelfDialogs } from "../hooks/useBookshelfDialogs";
import { fetchBooksInSelectedBookshelf } from "../slice";
import { andSearch, sortBy } from "../utils/BookshelfUtils";
import BookCard from "./BookCard";
import BookContextMenu from "./BookContextMenu";
import AddBooksToBookshelvesDialog from "./Dialog/AddBooksToBookshelvesDialog";
import BookDeleteDialog from "./Dialog/BookDeleteDialog";
import SetBookTagsDialog from "./Dialog/SetBookTagsDialog";
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
    activeView,
  } = useAppSelector(selectBookGridState);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useResizeObserver(containerRef);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    book: BookWithState;
  } | null>(null);

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

  const filteredSortedBooks = useMemo(() => {
    const books =
      tagId === null
        ? booksInSelectedBookshelf
        : booksInSelectedBookshelf.filter((book) =>
            book.tag_ids_str?.split(",").includes(tagId.toString()),
          );

    return andSearch(books, searchText)
      .slice()
      .sort((a, b) => sortBy(a, b, bookshelfSettings.sortOrder));
  }, [booksInSelectedBookshelf, tagId, searchText, bookshelfSettings.sortOrder]);

  const bookIdToIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    filteredSortedBooks.forEach((book, index) => {
      map.set(book.id, index);
    });
    return map;
  }, [filteredSortedBooks]);

  const handleGridSizeChange = useCallback(
    (newValue: number) => {
      const newBookshelfSettings = { ...bookshelfSettings, gridSize: newValue };
      dispatch(updateSettings({ key: "bookshelf", value: newBookshelfSettings }));
    },
    [dispatch, bookshelfSettings],
  );

  useEffect(() => {
    if (activeView === "bookshelf") {
      dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
      clearSelection();
    }
  }, [dispatch, bookshelfId, activeView, clearSelection]);

  const handleBookClick = useCallback(
    (book: BookWithState, e: React.MouseEvent) => {
      handleSelectionClick(book, e, filteredSortedBooks, bookIdToIndexMap, onBookSelect);
    },
    [filteredSortedBooks, onBookSelect, bookIdToIndexMap, handleSelectionClick],
  );

  const handleBookContextMenu = useCallback((book: BookWithState, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, book });
  }, []);

  const getTargetBooks = useCallback(
    (book?: BookWithState) => {
      return book
        ? selectedBookIds.has(book.id)
          ? filteredSortedBooks.filter((b) => selectedBookIds.has(b.id))
          : [book]
        : filteredSortedBooks.filter((b) => selectedBookIds.has(b.id));
    },
    [selectedBookIds, filteredSortedBooks],
  );

  const openAddBookshelvesDialog = useCallback(
    (book?: BookWithState) => {
      openDialog("add-to-bookshelf", getTargetBooks(book));
    },
    [openDialog, getTargetBooks],
  );

  const openTagsDialog = useCallback(
    (book?: BookWithState) => {
      openDialog("set-tags", getTargetBooks(book));
    },
    [openDialog, getTargetBooks],
  );

  const openDeleteDialog = useCallback(
    (book?: BookWithState) => {
      openDialog("delete-books", getTargetBooks(book));
    },
    [openDialog, getTargetBooks],
  );

  const columnWidth = currentGridSize.width;
  const rowHeight = currentGridSize.height;

  const columnCount =
    containerWidth > 0 ? Math.max(1, Math.floor(containerWidth / columnWidth)) : 1;
  const rowCount =
    filteredSortedBooks.length === 0 ? 0 : Math.ceil(filteredSortedBooks.length / columnCount);

  const cellProps = useMemo(
    () => ({
      books: filteredSortedBooks,
      tags: availableTags,
      size: (bookshelfSettings.gridSize === 0 ? "small" : "medium") as "small" | "medium",
      columnCount,
      onBookClick: handleBookClick,
      onBookContextMenu: handleBookContextMenu,
      enableAutoScroll: bookshelfSettings.enableAutoScroll,
    }),
    [
      filteredSortedBooks,
      availableTags,
      bookshelfSettings.gridSize,
      columnCount,
      handleBookClick,
      handleBookContextMenu,
      bookshelfSettings.enableAutoScroll,
    ],
  );

  return (
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
        onContextMenu={() => {
          if (contextMenu) {
            setContextMenu(null);
          }
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
        ) : filteredSortedBooks.length === 0 ? (
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
              cellComponent={BookCard}
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
        onAddToBookshelf={() => openAddBookshelvesDialog()}
        onSetTags={() => openTagsDialog()}
        onDelete={() => openDeleteDialog()}
      />

      <BookContextMenu
        anchor={contextMenu}
        onClose={() => setContextMenu(null)}
        onAddToBookshelf={openAddBookshelvesDialog}
        onSetTags={openTagsDialog}
        onDelete={openDeleteDialog}
      />

      <AddBooksToBookshelvesDialog
        openDialog={dialogType === "add-to-bookshelf"}
        bookIds={dialogBookIds}
        availableBookshelves={availableBookshelves}
        onClose={() => {
          closeDialog();
          clearSelection();
        }}
        onAddBooks={() => {
          dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
        }}
      />
      <SetBookTagsDialog
        openDialog={dialogType === "set-tags"}
        bookIds={dialogBookIds}
        availableTags={availableTags}
        onClose={() => {
          closeDialog();
          clearSelection();
        }}
        onUpdateTags={() => {
          dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
        }}
      />
      <BookDeleteDialog
        openDialog={dialogType === "delete-books"}
        books={dialogBooks}
        onClose={() => {
          closeDialog();
          clearSelection();
        }}
      />
    </Stack>
  );
}
