import {
  Badge,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Tooltip,
  Typography,
} from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useMemo } from "react";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import AutoScrollTypography from "../../../components/ui/AutoScrollTypography/AutoScrollTypography";
import type { BookWithState, Series } from "../../../types/DatabaseModels";

export interface SeriesCardProps {
  /** The series to display */
  series: Series;
  /** The list of books in this series */
  books: BookWithState[];
  /** Whether to enable automatic horizontal scrolling for overflowing text. */
  enableAutoScroll?: boolean;
  /** Callback for when the series is clicked */
  onClick: (seriesId: number) => void;
  /** Styling for the container */
  style?: React.CSSProperties;
}

/**
 * A component to display a series of books as a single card with a stack effect.
 */
export default function SeriesCard({
  series,
  books,
  enableAutoScroll = true,
  onClick,
  style,
}: SeriesCardProps) {
  // Sort books by series_order to ensure the first volume is on top if possible
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0));
  }, [books]);

  // Use the first few books for the stack effect
  const stackBooks = useMemo(() => sortedBooks.slice(0, 3).reverse(), [sortedBooks]);

  const handleCardClick = () => {
    onClick(series.id);
  };

  return (
    <Box
      sx={{
        padding: "8px",
        ...style,
      }}
    >
      <Tooltip title={series.name} followCursor placement="right-start">
        <Card
          sx={{
            width: "100%",
            height: "100%",
            bgcolor: "primary.paper",
            position: "relative",
            overflow: "visible", // To allow stack/badge to overflow if needed, but normally within padding
          }}
        >
          <CardActionArea
            onClick={handleCardClick}
            sx={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <Box
              sx={{
                position: "relative",
                width: "100%",
                // Aspect ratio for the thumbnail area (approx 2:3)
                paddingTop: "140%",
                backgroundColor: "action.hover",
              }}
            >
              {/* Stack effect */}
              {stackBooks.map((book, index) => {
                const imageSrc = book.thumbnail_path
                  ? convertFileSrc(book.thumbnail_path)
                  : dummy_thumbnail;
                const offset = (stackBooks.length - 1 - index) * 4;
                return (
                  <Box
                    key={book.id}
                    sx={{
                      position: "absolute",
                      top: 4 - offset,
                      left: 4 + offset,
                      width: "calc(100% - 16px)",
                      height: "calc(100% - 16px)",
                      zIndex: index,
                      boxShadow: 3,
                      transition: "transform 0.2s",
                      "&:hover": {
                        transform: "translateY(-4px)",
                      },
                    }}
                  >
                    <CardMedia
                      component="img"
                      image={imageSrc}
                      alt={book.display_name}
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                  </Box>
                );
              })}

              {/* Volume count badge */}
              <Box
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  zIndex: 10,
                }}
              >
                <Badge
                  badgeContent={books.length}
                  color="primary"
                  sx={{
                    "& .MuiBadge-badge": {
                      fontSize: "0.75rem",
                      height: "20px",
                      minWidth: "20px",
                      borderRadius: "10px",
                      padding: "0 6px",
                    },
                  }}
                />
              </Box>
            </Box>

            <CardContent
              sx={{
                flexGrow: 1,
                padding: "8px",
                width: "100%",
                // Ensure text doesn't overflow the card content area
                "&:last-child": { paddingBottom: "8px" },
              }}
            >
              <Box sx={{ height: "3em", overflow: "hidden" }}>
                {enableAutoScroll ? (
                  <AutoScrollTypography variant="subtitle2" component="div" text={series.name} />
                ) : (
                  <Typography
                    variant="subtitle2"
                    component="div"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: "1.2em",
                    }}
                  >
                    {series.name}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </CardActionArea>
        </Card>
      </Tooltip>
    </Box>
  );
}
