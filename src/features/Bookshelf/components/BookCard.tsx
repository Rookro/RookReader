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
import { useMemo, useState } from "react";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import AutoScrollTypography from "../../../components/ui/AutoScrollTypography/AutoScrollTypography";
import type { BookWithState, Tag } from "../../../types/DatabaseModels";
import { useBookSelection } from "../hooks/useBookSelection";
import BookContextMenu from "./BookContextMenu";

export interface BookCardProps {
  /** The book to display */
  book: BookWithState;
  /** The list of tags to display */
  tags: Tag[];
  /** The size of the card */
  size: "small" | "medium";
  /** Whether to enable automatic horizontal scrolling for overflowing text. */
  enableAutoScroll: boolean;
  /** Callback for when a book is selected/clicked */
  onBookClick?: (book: BookWithState, event: React.MouseEvent) => void;
  /** Styling for the container */
  style?: React.CSSProperties;
}

/**
 * A component to display a single book card.
 * Handles its own context menu internally.
 */
export default function BookCard({
  book,
  tags,
  size,
  enableAutoScroll,
  onBookClick,
  style,
}: BookCardProps) {
  const { selectedBookIds } = useBookSelection();
  const [menuAnchor, setMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);

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

  const isSelected = selectedBookIds.has(book.id);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuAnchor({ mouseX: e.clientX, mouseY: e.clientY });
  };

  return (
    <Box
      key={book.id}
      sx={{
        padding: "8px",
        ...style,
      }}
      onContextMenu={handleContextMenu}
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
                    ? ((book.last_read_page_index ? book.last_read_page_index + 1 : 0) /
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
      <BookContextMenu book={book} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />
    </Box>
  );
}
