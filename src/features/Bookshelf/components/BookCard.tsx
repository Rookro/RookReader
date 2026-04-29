import { CheckCircle } from "@mui/icons-material";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  LinearProgress,
  Stack,
  Tooltip,
} from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useMemo } from "react";
import type { CellComponentProps } from "react-window";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import AutoScrollTypography from "../../../components/ui/AutoScrollTypography/AutoScrollTypography";
import type { BookWithState, Tag } from "../../../types/DatabaseModels";
import { useSelection } from "./BookGrid";

export interface BookCardProps {
  /** The list of books to display */
  books: BookWithState[];
  /** The list of tags to display */
  tags: Tag[];
  /** The size of the card */
  size: "small" | "medium";
  /** The number of columns in the bookshelf */
  columnCount: number;
  /** Whether to enable automatic horizontal scrolling for overflowing text. */
  enableAutoScroll: boolean;
  /** Callback for when a book is selected/clicked */
  onBookClick?: (book: BookWithState, event: React.MouseEvent) => void;
  /** Callback for when a book is context menu */
  onBookContextMenu?: (book: BookWithState, event: React.MouseEvent) => void;
}

/** A component to display a single book card. */
function BookCardInner({
  books,
  tags,
  columnCount,
  enableAutoScroll,
  onBookClick,
  onBookContextMenu,
  columnIndex,
  rowIndex,
  size,
  style,
}: CellComponentProps<BookCardProps>) {
  const index = rowIndex * columnCount + columnIndex;
  const book = books[index];
  const { selectedBookIds } = useSelection();

  const imageSrc = useMemo(() => {
    return book?.thumbnail_path ? convertFileSrc(book.thumbnail_path) : dummy_thumbnail;
  }, [book?.thumbnail_path]);

  const bookTags = useMemo(() => {
    if (!book?.tag_ids_str || !tags) {
      return [];
    }
    const ids = book.tag_ids_str.split(",").map(Number);
    return tags.filter((tag) => ids.includes(tag.id));
  }, [book?.tag_ids_str, tags]);

  if (!book) {
    return null;
  }

  const isSelected = selectedBookIds.has(book.id);

  return (
    <Box
      key={`${book.id}-${book.tag_ids_str}`}
      sx={{
        padding: "8px",
        ...style,
      }}
    >
      <Tooltip title={book.display_name} followCursor placement="right-start">
        <Card
          sx={{
            width: "100%",
            height: "100%",
            bgcolor: "primary.paper",
            outline: isSelected ? "3px solid" : "none",
            outlineColor: "primary.main",
            position: "relative",
          }}
        >
          {isSelected && (
            <CheckCircle
              color="primary"
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 1,
                backgroundColor: "background.paper",
                borderRadius: "50%",
              }}
            />
          )}
          <CardActionArea
            onClick={(e) => onBookClick?.(book, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              onBookContextMenu?.(book, e);
            }}
            sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
          >
            <CardContent
              sx={{
                width: "100%",
                padding: 1,
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
              }}
            >
              <Box sx={{ position: "relative", flexGrow: 1, width: "100%", height: "100%" }}>
                <CardMedia
                  component="img"
                  image={imageSrc}
                  alt={book.display_name}
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectPosition: "center center",
                    objectFit: "contain",
                    opacity: isSelected ? 0.8 : 1,
                  }}
                />
                {bookTags.length > 0 && (
                  <Stack
                    direction="row"
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: 1,
                      flexWrap: "wrap",
                      justifyContent: "flex-start",
                      maxWidth: "100%",
                    }}
                  >
                    {bookTags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size={size}
                        sx={{
                          backgroundColor: tag.color_code,
                          fontSize: "0.65rem",
                          height: "20px",
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>

              <AutoScrollTypography
                variant="body1"
                text={book.display_name}
                enabled={enableAutoScroll}
                sx={{ paddingTop: 1, paddingBottom: 1 }}
              />
              <LinearProgress
                variant="determinate"
                value={
                  book.total_pages !== 0
                    ? ((book.last_read_page_index ? book.last_read_page_index + 1 : 1) /
                        book.total_pages) *
                      100
                    : 0
                }
                sx={{
                  height: 8,
                  borderRadius: 1,
                }}
              />
            </CardContent>
          </CardActionArea>
        </Card>
      </Tooltip>
    </Box>
  );
}

function areEqual(
  prevProps: Readonly<CellComponentProps<BookCardProps>>,
  nextProps: Readonly<CellComponentProps<BookCardProps>>,
) {
  // Basic structural checks
  if (
    prevProps.columnIndex !== nextProps.columnIndex ||
    prevProps.rowIndex !== nextProps.rowIndex ||
    prevProps.columnCount !== nextProps.columnCount ||
    prevProps.size !== nextProps.size ||
    prevProps.tags !== nextProps.tags ||
    prevProps.enableAutoScroll !== nextProps.enableAutoScroll
  ) {
    return false;
  }

  // Book specific checks
  const index = prevProps.rowIndex * prevProps.columnCount + prevProps.columnIndex;
  const prevBook = prevProps.books[index];
  const nextBook = nextProps.books[index];

  if (prevBook !== nextBook) {
    return false;
  }

  // Style prop check for react-window
  if (prevProps.style !== nextProps.style) {
    if (
      prevProps.style.top !== nextProps.style.top ||
      prevProps.style.left !== nextProps.style.left ||
      prevProps.style.width !== nextProps.style.width ||
      prevProps.style.height !== nextProps.style.height
    ) {
      return false;
    }
  }

  return true;
}

const MemoizedBookCard = memo(BookCardInner, areEqual);

export default function BookCard(props: CellComponentProps<BookCardProps>) {
  return <MemoizedBookCard {...props} />;
}
