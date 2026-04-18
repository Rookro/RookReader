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
import { useMemo } from "react";
import type { CellComponentProps } from "react-window";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import AutoScrollTypography from "../../../components/ui/AutoScrollTypography/AutoScrollTypography";
import type { BookWithState, Tag } from "../../../types/DatabaseModels";

/** A component to display a single book card. */
export default function BookCard({
  books,
  tags,
  columnCount,
  onBookSelect,
  onBookContextMenu,
  columnIndex,
  rowIndex,
  size,
  style,
}: CellComponentProps<{
  /** The list of books to display */
  books: BookWithState[];
  /** The list of tags to display */
  tags: Tag[];
  /** The size of the card */
  size: "small" | "medium";
  /** The number of columns in the bookshelf */
  columnCount: number;
  /** Callback for when a book is selected */
  onBookSelect?: (book: BookWithState) => void;
  /** Callback for when a book is context menu */
  onBookContextMenu?: (book: BookWithState, event: React.MouseEvent) => void;
}>) {
  const index = rowIndex * columnCount + columnIndex;
  const book = books[index];

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
          }}
        >
          <CardActionArea
            onClick={() => onBookSelect?.(book)}
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
                sx={{ paddingTop: 1, paddingBottom: 1 }}
              />
              <LinearProgress
                variant="determinate"
                value={
                  book.total_pages !== 0
                    ? ((book.last_read_page_index ?? 0) / book.total_pages) * 100
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
