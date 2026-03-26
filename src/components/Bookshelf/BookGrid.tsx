import {
  Box,
  CircularProgress,
  Stack,
  Menu,
  MenuItem,
  Slider,
  Divider,
  Paper,
  ListItemIcon,
  ListItemText,
  debounce,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Grid } from "react-window";
import { Book, BookWithState } from "../../types/DatabaseModels";
import BookCard from "./BookCard";
import NavigationBar from "./NavigationBar";
import { useAppDispatch, useAppSelector } from "../../Store";
import { Delete, LocalOffer, ZoomIn, ZoomOut } from "@mui/icons-material";
import SetBookTagsDialog from "./Dialog/SetBookTagsDialog";
import { fetchBooksInSelectedBookshelf } from "../../reducers/BookCollectionReducer";
import { useTranslation } from "react-i18next";
import { andSearch, sortBy } from "../../utils/BookshelfUtils";
import BookDeleteDialog from "./Dialog/BookDeleteDialog";
import { updateSettings } from "../../reducers/SettingsReducer";

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
  const bookshelfSettings = useAppSelector((state) => state.settings.bookshelf);
  const {
    searchText,
    bookshelf: { books: booksInSelectedBookshelf, selectedId: bookshelfId, status },
    tag: { selectedId: tagId, tags: availableTags },
  } = useAppSelector((state) => state.bookCollection);
  const { activeView } = useAppSelector((state) => state.view);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    book: BookWithState;
  } | null>(null);
  const [isSetTagsDialogOpen, setIsSetTagsDialogOpen] = useState(false);
  const [selectedBookForTags, setSelectedBookForTags] = useState<BookWithState | null>(null);
  const [isDeleteBookDialogOpen, setIsDeleteBookDialogOpen] = useState(false);
  const [selectedBookForDelete, setSelectedBookForDelete] = useState<BookWithState | null>(null);

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
    }
  }, [dispatch, bookshelfId, activeView]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0 && entries[0]) {
        debouncedUpdateContainerWidth(entries[0].contentRect.width);
      }
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
      debouncedUpdateContainerWidth.clear();
    };
  }, [debouncedUpdateContainerWidth]);

  const columnCount =
    containerWidth > 0 ? Math.max(1, Math.floor(containerWidth / currentGridSize.width)) : 1;
  const rowCount =
    filteredSortedBooks.length === 0 ? 0 : Math.ceil(filteredSortedBooks.length / columnCount);

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
              width: columnCount * currentGridSize.width,
              margin: "0 auto",
              // Prevent overlap with bottom floating buttons
              paddingBottom: "60px",
            }}
          >
            <Grid
              cellComponent={BookCard}
              columnCount={columnCount}
              columnWidth={currentGridSize.width}
              rowCount={rowCount}
              rowHeight={currentGridSize.height}
              cellProps={{
                books: filteredSortedBooks,
                tags: availableTags,
                size: bookshelfSettings.gridSize === 0 ? "small" : "medium",
                columnCount,
                onBookSelect,
                onBookContextMenu: (book: BookWithState, e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu(
                    contextMenu === null ? { mouseX: e.clientX, mouseY: e.clientY, book } : null,
                  );
                },
              }}
            />
          </Box>
        )}
      </Box>

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
              setSelectedBookForTags(contextMenu.book);
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
              setSelectedBookForDelete(contextMenu.book);
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

      <SetBookTagsDialog
        openDialog={isSetTagsDialogOpen}
        bookId={selectedBookForTags?.id ?? null}
        availableTags={availableTags}
        onClose={() => {
          setIsSetTagsDialogOpen(false);
          setSelectedBookForTags(null);
        }}
        onUpdateTags={() => {
          dispatch(fetchBooksInSelectedBookshelf(bookshelfId));
        }}
      />
      <BookDeleteDialog
        openDialog={isDeleteBookDialogOpen}
        book={selectedBookForDelete ?? null}
        onClose={() => setIsDeleteBookDialogOpen(false)}
      />
    </Stack>
  );
}
