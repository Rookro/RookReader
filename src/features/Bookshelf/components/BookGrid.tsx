import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "react-window";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import type { Book, BookWithState } from "../../../types/DatabaseModels";
import { updateSettings } from "../../Settings/slice";
import { useBookSelection } from "../hooks/useBookSelection";
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

  const bookshelfSettings = useAppSelector((state) => state.settings.bookshelf);
  const searchText = useAppSelector((state) => state.bookCollection.searchText);
  const booksInSelectedBookshelf = useAppSelector((state) => state.bookCollection.bookshelf.books);
  const availableBookshelves = useAppSelector(
    (state) => state.bookCollection.bookshelf.bookshelves,
  );
  const bookshelfId = useAppSelector((state) => state.bookCollection.bookshelf.selectedId);
  const status = useAppSelector((state) => state.bookCollection.bookshelf.status);
  const tagId = useAppSelector((state) => state.bookCollection.tag.selectedId);
  const availableTags = useAppSelector((state) => state.bookCollection.tag.tags);
  const activeView = useAppSelector((state) => state.view.activeView);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useResizeObserver(containerRef);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    book: BookWithState;
  } | null>(null);

  const [isAddBookshelvesDialogOpen, setIsAddBookshelvesDialogOpen] = useState(false);
  const [selectedBooksForBookshelves, setSelectedBooksForBookshelves] = useState<number[]>([]);
  const [isSetTagsDialogOpen, setIsSetTagsDialogOpen] = useState(false);
  const [selectedBooksForTags, setSelectedBooksForTags] = useState<number[]>([]);
  const [isDeleteBookDialogOpen, setIsDeleteBookDialogOpen] = useState(false);
  const [selectedBooksForDelete, setSelectedBooksForDelete] = useState<BookWithState[]>([]);

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

  const openAddBookshelvesDialog = useCallback(
    (book?: BookWithState) => {
      const ids = book
        ? selectedBookIds.has(book.id)
          ? Array.from(selectedBookIds)
          : [book.id]
        : Array.from(selectedBookIds);
      setSelectedBooksForBookshelves(ids);
      setIsAddBookshelvesDialogOpen(true);
    },
    [selectedBookIds],
  );

  const openTagsDialog = useCallback(
    (book?: BookWithState) => {
      const ids = book
        ? selectedBookIds.has(book.id)
          ? Array.from(selectedBookIds)
          : [book.id]
        : Array.from(selectedBookIds);
      setSelectedBooksForTags(ids);
      setIsSetTagsDialogOpen(true);
    },
    [selectedBookIds],
  );

  const openDeleteDialog = useCallback(
    (book?: BookWithState) => {
      const books = book
        ? selectedBookIds.has(book.id)
          ? filteredSortedBooks.filter((b) => selectedBookIds.has(b.id))
          : [book]
        : filteredSortedBooks.filter((b) => selectedBookIds.has(b.id));
      setSelectedBooksForDelete(books);
      setIsDeleteBookDialogOpen(true);
    },
    [filteredSortedBooks, selectedBookIds],
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
        openDialog={isAddBookshelvesDialogOpen}
        bookIds={selectedBooksForBookshelves}
        availableBookshelves={availableBookshelves}
        onClose={() => {
          setIsAddBookshelvesDialogOpen(false);
          setSelectedBooksForBookshelves([]);
          clearSelection();
        }}
        onAddBooks={() => {
          // You might not want to refresh the entire current list if the user isn't in a view that changed.
          // But refreshing is safe.
          dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
        }}
      />
      <SetBookTagsDialog
        openDialog={isSetTagsDialogOpen}
        bookIds={selectedBooksForTags}
        availableTags={availableTags}
        onClose={() => {
          setIsSetTagsDialogOpen(false);
          setSelectedBooksForTags([]);
          clearSelection();
        }}
        onUpdateTags={() => {
          dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
        }}
      />
      <BookDeleteDialog
        openDialog={isDeleteBookDialogOpen}
        books={selectedBooksForDelete}
        onClose={() => {
          setIsDeleteBookDialogOpen(false);
          setSelectedBooksForDelete([]);
          clearSelection();
        }}
      />
    </Stack>
  );
}
