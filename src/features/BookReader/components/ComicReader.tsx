import { Box } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useEffect, useMemo } from "react";
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
    }),
    [
      readerSettings.comic.enableSpread,
      readerSettings.comic.showCoverAsSinglePage,
      readerSettings.comic.readingDirection,
      readerSettings.rendering.enableThumbnailPreview,
    ],
  );

  const { displayedLayout, moveForward, moveBack } = useViewerController(
    containerPath,
    entries,
    index,
    settings,
    dispatch,
  );

  const loupeSettings = readerSettings.comic.loupe;

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

  if (!displayedLayout) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
        }}
      />
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
