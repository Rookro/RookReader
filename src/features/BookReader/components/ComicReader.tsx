import { Box, CircularProgress } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useEffect, useMemo, useState } from "react";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { useLoupe } from "../hooks/useLoupe";
import { usePageNavigation } from "../hooks/usePageNavigation";
import { useViewerController } from "../hooks/useViewerController";
import type { ViewerSettings } from "../utils/ImageUtils";
import Loupe from "./Loupe";

const selectComicReaderState = createSelector(
  [(state: RootState) => state.read.containerFile, (state: RootState) => state.settings.reader],
  (containerFile, readerSettings) => ({
    history: containerFile.history,
    historyIndex: containerFile.historyIndex,
    entries: containerFile.entries,
    index: containerFile.index,
    readerSettings,
  }),
);

/**
 * Component for displaying images of comics.
 */
export default function ComicReader() {
  const dispatch = useAppDispatch();
  const { history, historyIndex, entries, index, readerSettings } =
    useAppSelector(selectComicReaderState);

  const containerPath = history[historyIndex];

  const settings: ViewerSettings = useMemo(
    () => ({
      isTwoPagedView: readerSettings.comic.enableSpread,
      isFirstPageSingleView: readerSettings.comic.showCoverAsSinglePage,
      direction: readerSettings.comic.readingDirection,
      enablePreview: readerSettings.rendering.enableThumbnailPreview,
      preloadPageCount: readerSettings.comic.cache.preloadPageCount,
    }),
    [
      readerSettings.comic.enableSpread,
      readerSettings.comic.showCoverAsSinglePage,
      readerSettings.comic.readingDirection,
      readerSettings.rendering.enableThumbnailPreview,
      readerSettings.comic.cache.preloadPageCount,
    ],
  );

  const { displayedLayout, moveForward, moveBack, isImageLoading } = useViewerController(
    containerPath,
    entries,
    index,
    settings,
    dispatch,
  );

  const loupeSettings = readerSettings.comic.loupe;

  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isImageLoading) {
      setShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowSpinner(true), 300);

    return () => {
      clearTimeout(timer);
    };
  }, [isImageLoading]);

  const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
    moveForward,
    moveBack,
    settings.direction,
  );

  const { isLoupeEnabled, loupePos, containerRef, handleMouseMove, handleMouseDown } = useLoupe(
    loupeSettings?.toggleKey,
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [handleKeydown]);

  const spinnerOverlay = showSpinner ? (
    <Box
      sx={(theme) => ({
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
        pointerEvents: "none",
        backgroundColor:
          theme.palette.mode === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)",
      })}
    >
      <CircularProgress />
    </Box>
  ) : null;

  if (!displayedLayout) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
        }}
      >
        {spinnerOverlay}
      </Box>
    );
  }

  const srcLeft =
    settings.direction === "ltr"
      ? displayedLayout.firstImage?.url
      : displayedLayout.secondImage?.url || displayedLayout.firstImage?.url;
  const srcRight =
    settings.direction === "ltr"
      ? displayedLayout.secondImage?.url
      : displayedLayout.firstImage?.url;
  const srcSingle = displayedLayout.firstImage?.url;

  return (
    <Box
      tabIndex={0}
      onClick={handleClicked}
      onContextMenu={handleContextMenu}
      onWheel={handleWheeled}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      ref={containerRef}
      data-testid="comic-reader-area"
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <Loupe
        isLoupeEnabled={isLoupeEnabled}
        loupePos={loupePos}
        containerRef={containerRef}
        zoom={loupeSettings?.zoom}
        radius={loupeSettings?.radius}
      >
        <Box sx={{ display: "flex", width: "100%", height: "100%" }}>
          {spinnerOverlay}
          {displayedLayout.isSpread ? (
            <>
              <Box
                component="img"
                src={srcLeft}
                alt="Left Page"
                sx={{
                  width: "50%",
                  height: "100%",
                  objectPosition: "right center",
                  objectFit: "contain",
                }}
              />
              <Box
                component="img"
                src={srcRight}
                alt="Right Page"
                sx={{
                  width: "50%",
                  height: "100%",
                  objectPosition: "left center",
                  objectFit: "contain",
                }}
              />
            </>
          ) : (
            <Box
              component="img"
              src={srcSingle}
              alt="Single Page"
              sx={{
                width: "100%",
                height: "100%",
                objectPosition: "center center",
                objectFit: "contain",
              }}
            />
          )}
        </Box>
      </Loupe>
    </Box>
  );
}
