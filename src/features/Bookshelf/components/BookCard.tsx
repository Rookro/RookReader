import { CheckCircle, MenuBook } from "@mui/icons-material";
import {
  alpha,
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
import { useTranslation } from "react-i18next";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import AutoScrollTypography from "../../../components/ui/AutoScrollTypography/AutoScrollTypography";
import type { BookWithState } from "../../../domain/book/schema";
import type { Tag } from "../../../domain/tag/schema";
import { useBookSelection } from "../hooks/useBookSelection";
import BookContextMenu from "./BookContextMenu";

export interface BookCardProps {
  /** The book to display */
  book: BookWithState;
  /** Currently filtered and sorted books (to get objects for multi-selection) */
  allBooks?: BookWithState[];
  /** The list of tags to display */
  tags: Tag[];
  /** The size of the card */
  size: "small" | "medium";
  /** Whether to enable automatic horizontal scrolling for overflowing text. */
  enableAutoScroll: boolean;
  /** Callback for when a book is selected/clicked */
  onBookClick?: (book: BookWithState, event: React.MouseEvent | React.KeyboardEvent) => void;
  /** Styling for the container */
  style?: React.CSSProperties;
  /** Whether the card is currently focused via keyboard navigation */
  isFocused?: boolean;
  /** Whether the card is currently being read */
  isReading?: boolean;
}

/**
 * A component to display a single book card.
 * Handles its own context menu internally.
 */
export default function BookCard({
  book,
  allBooks = [],
  tags,
  size,
  enableAutoScroll,
  onBookClick,
  style,
  isFocused,
  isReading,
}: BookCardProps) {
  const { t } = useTranslation();
  const { selectedBookIds } = useBookSelection();
  const [menuAnchor, setMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [imageError, setImageError] = useState(false);

  const selectedBooks = useMemo(() => {
    if (selectedBookIds.size === 0) return [];
    return allBooks.filter((b) => selectedBookIds.has(b.id));
  }, [selectedBookIds, allBooks]);

  const imageSrc = useMemo(() => {
    return !imageError && book?.thumbnail_path
      ? convertFileSrc(book.thumbnail_path)
      : dummy_thumbnail;
  }, [book?.thumbnail_path, imageError]);

  const bookTags = useMemo(() => {
    if (!book?.tag_ids || !tags) {
      return [];
    }
    return tags.filter((tag) => book.tag_ids.includes(tag.id));
  }, [book?.tag_ids, tags]);

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
          sx={(theme) => ({
            width: "100%",
            height: "100%",
            bgcolor: isReading ? alpha(theme.palette.secondary.main, 0.3) : "primary.paper",
            outline: isSelected || isFocused || isReading ? "3px solid" : "none",
            outlineColor: isSelected
              ? "primary.main"
              : isReading
                ? "secondary.main"
                : "action.focus",
            position: "relative",
            boxShadow: isFocused || isReading ? 8 : 1,
          })}
        >
          {isReading && (
            <Chip
              icon={<MenuBook fontSize="small" />}
              label={t("bookshelf.reading-chip-label")}
              color="secondary"
              size="small"
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                zIndex: 1,
              }}
            />
          )}
          {isSelected && (
            <CheckCircle
              color="primary"
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                zIndex: 2,
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
                  onError={() => setImageError(true)}
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
                    ? (((book.last_read_page_index ?? -1) + 1) / book.total_pages) * 100
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
      <BookContextMenu
        book={book}
        selectedBooks={selectedBooks}
        anchor={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      />
    </Box>
  );
}
