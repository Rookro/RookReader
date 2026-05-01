import { Close, Delete, LibraryBooks, LocalOffer, ZoomIn, ZoomOut } from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  debounce,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "react-window";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import type { Book, BookWithState } from "../../../types/DatabaseModels";
import { updateSettings } from "../../Settings/slice";
import { useBookSelection } from "../hooks/useBookSelection";
import { fetchBooksInSelectedBookshelf } from "../slice";
import { andSearch, sortBy } from "../utils/BookshelfUtils";
import BookCard from "./BookCard";
import AddBooksToBookshelvesDialog from "./Dialog/AddBooksToBookshelvesDialog";
import BookDeleteDialog from "./Dialog/BookDeleteDialog";
import SetBookTagsDialog from "./Dialog/SetBookTagsDialog";
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

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

  const debouncedUpdateContainerWidth = useMemo(
    () =>
      debounce((currentWidth: number) => {
        setContainerWidth(currentWidth);
      }, 100),
    [],
  );

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
    (_e: Event, newValue: number, _activeThumb: number) => {
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

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let previousWidth = 0;
    let visibleTime = 0;

    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0 && entries[0]) {
        const newWidth = entries[0].contentRect.width;

        if (newWidth <= 0 || newWidth === previousWidth) {
          return;
        }

        const now = performance.now();

        if (previousWidth === 0) {
          visibleTime = now;
          debouncedUpdateContainerWidth.clear();
          setContainerWidth(newWidth);
        } else if (now - visibleTime < 200) {
          debouncedUpdateContainerWidth.clear();
          setContainerWidth(newWidth);
        } else {
          debouncedUpdateContainerWidth(newWidth);
        }

        previousWidth = newWidth;
      }
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
      debouncedUpdateContainerWidth.clear();
    };
  }, [debouncedUpdateContainerWidth]);

  const handleBookClick = useCallback(
    (book: BookWithState, e: React.MouseEvent) => {
      handleSelectionClick(book, e, filteredSortedBooks, bookIdToIndexMap, onBookSelect);
    },
    [filteredSortedBooks, onBookSelect, bookIdToIndexMap, handleSelectionClick],
  );

  const handleBookContextMenu = useCallback((book: BookWithState, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu((prev) =>
      prev === null ? { mouseX: e.clientX, mouseY: e.clientY, book } : null,
    );
  }, []);

  const openAddBookshelvesDialogForSelection = useCallback(() => {
    setSelectedBooksForBookshelves(Array.from(selectedBookIds));
    setIsAddBookshelvesDialogOpen(true);
  }, [selectedBookIds]);

  const openTagsDialogForSelection = useCallback(() => {
    setSelectedBooksForTags(Array.from(selectedBookIds));
    setIsSetTagsDialogOpen(true);
  }, [selectedBookIds]);

  const openDeleteDialogForSelection = useCallback(() => {
    const booksToDelete = filteredSortedBooks.filter((b) => selectedBookIds.has(b.id));
    setSelectedBooksForDelete(booksToDelete);
    setIsDeleteBookDialogOpen(true);
  }, [filteredSortedBooks, selectedBookIds]);

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
      <Paper
        elevation={2}
        sx={{
          position: "absolute",
          bottom: 16,
          right: 16,
          padding: 1,
          borderRadius: 3,
          width: 200,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%" }}>
          <ZoomOut />
          <Slider
            defaultValue={bookshelfSettings.gridSize}
            onChange={handleGridSizeChange}
            min={0}
            max={2}
            step={1}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => {
              const labels = [
                t("bookshelf.grid-size.small"),
                t("bookshelf.grid-size.medium"),
                t("bookshelf.grid-size.large"),
              ];
              return labels[value];
            }}
          />
          <ZoomIn />
        </Stack>
      </Paper>

      {/* Floating Action Bar for Selection */}
      {selectedBookIds.size > 0 && (
        <Box
          sx={{
            position: "absolute",
            bottom: 16,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            paddingX: 2,
          }}
        >
          <Paper
            elevation={4}
            sx={{
              paddingX: 2,
              paddingY: 1,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <Typography variant="body2" fontWeight="bold">
              {t("bookshelf.selection.count", { count: selectedBookIds.size })}
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.contrastText" }} />
            <Button
              size="small"
              color="inherit"
              startIcon={<LibraryBooks />}
              onClick={openAddBookshelvesDialogForSelection}
            >
              {t("bookshelf.collection.add-books-title")}
            </Button>
            <Button
              size="small"
              color="inherit"
              startIcon={<LocalOffer />}
              onClick={openTagsDialogForSelection}
            >
              {t("bookshelf.tag.set-tags")}
            </Button>
            <Button
              size="small"
              color="inherit"
              startIcon={<Delete />}
              onClick={openDeleteDialogForSelection}
            >
              {t("bookshelf.remove-book")}
            </Button>
            <IconButton
              size="small"
              color="inherit"
              onClick={clearSelection}
              title={t("bookshelf.selection.clear")}
            >
              <Close fontSize="small" />
            </IconButton>
          </Paper>
        </Box>
      )}

      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        <MenuItem
          dense
          onClick={() => {
            if (contextMenu) {
              const idsToAdd = selectedBookIds.has(contextMenu.book.id)
                ? Array.from(selectedBookIds)
                : [contextMenu.book.id];
              setSelectedBooksForBookshelves(idsToAdd);
              setIsAddBookshelvesDialogOpen(true);
            }
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <LibraryBooks sx={{ color: "text.secondary" }} />
          </ListItemIcon>
          <ListItemText>{t("bookshelf.collection.add-books-title")}</ListItemText>
        </MenuItem>
        <MenuItem
          dense
          onClick={() => {
            if (contextMenu) {
              const idsToTag = selectedBookIds.has(contextMenu.book.id)
                ? Array.from(selectedBookIds)
                : [contextMenu.book.id];
              setSelectedBooksForTags(idsToTag);
              setIsSetTagsDialogOpen(true);
            }
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <LocalOffer sx={{ color: "text.secondary" }} />
          </ListItemIcon>
          <ListItemText>{t("bookshelf.tag.set-tags")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          dense
          onClick={() => {
            if (contextMenu) {
              const booksToDelete = selectedBookIds.has(contextMenu.book.id)
                ? filteredSortedBooks.filter((b) => selectedBookIds.has(b.id))
                : [contextMenu.book];
              setSelectedBooksForDelete(booksToDelete);
              setIsDeleteBookDialogOpen(true);
            }
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <Delete color="error" />
          </ListItemIcon>
          <ListItemText>{t("bookshelf.remove-book")}</ListItemText>
        </MenuItem>
      </Menu>

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
