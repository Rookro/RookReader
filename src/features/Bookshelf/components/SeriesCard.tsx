import { Badge, Box, Card, CardActionArea, CardContent, CardMedia, Tooltip } from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useMemo, useState } from "react";
import dummy_thumbnail from "../../../assets/dummy_thumbnail.svg";
import AutoScrollTypography from "../../../components/ui/AutoScrollTypography/AutoScrollTypography";
import type { BookWithState, Series } from "../../../types/DatabaseModels";
import SeriesContextMenu from "./SeriesContextMenu";

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
 * Handles its own context menu internally.
 */
export default function SeriesCard({
  series,
  books,
  enableAutoScroll = true,
  onClick,
  style,
}: SeriesCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<{ mouseX: number; mouseY: number } | null>(null);

  // Sort books by series_order to ensure the first volume is on top if possible
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0));
  }, [books]);

  // Use the first few books for the stack effect
  const stackBooks = useMemo(() => sortedBooks.slice(0, 3), [sortedBooks]);

  const handleCardClick = () => {
    onClick(series.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuAnchor({ mouseX: e.clientX, mouseY: e.clientY });
  };

  return (
    <Box
      key={series.id}
      sx={{
        padding: "8px",
        ...style,
      }}
      onContextMenu={handleContextMenu}
    >
      <Tooltip title={series.name} followCursor placement="right-start">
        <Card sx={{ width: "100%", height: "100%" }}>
          <CardActionArea
            onClick={handleCardClick}
            sx={{ height: "100%", display: "flex", flexDirection: "column" }}
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
                <Badge
                  badgeContent={books.length}
                  color="primary"
                  sx={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                />

                {/* Stack effect (max 3 books) */}
                {stackBooks.map((book, index) => {
                  const imageSrc = book.thumbnail_path
                    ? convertFileSrc(book.thumbnail_path)
                    : dummy_thumbnail;

                  // index 0: Top cover, index 2: Bottom-most
                  const offset = index * 5;

                  return (
                    <Box
                      key={book.id}
                      sx={{
                        position: "absolute",
                        top: `${3 + offset}%`,
                        left: `${3 + offset}%`,
                        width: "85%",
                        height: "85%",
                        zIndex: 3 - index,
                        boxShadow: 4,
                        transition: "transform 0.2s",
                        backgroundColor: "background.paper",
                        borderRadius: "2px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        "&:hover": {
                          transform: "translateY(-2%)",
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
                          objectPosition: "center center",
                          objectFit: "contain",
                          borderRadius: "2px",
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
              <AutoScrollTypography
                variant="body1"
                text={series.name}
                enabled={enableAutoScroll}
                sx={{ paddingTop: 1, paddingBottom: 1 }}
              />
            </CardContent>
          </CardActionArea>
        </Card>
      </Tooltip>
      <SeriesContextMenu series={series} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />
    </Box>
  );
}
