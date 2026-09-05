import { Box, CircularProgress } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useEffect, useMemo, useState } from "react";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import type { ErrorCode } from "../../../types/Error";
import { useAdjacentBookNavigation } from "../hooks/useAdjacentBookNavigation";
import { useLoupe } from "../hooks/useLoupe";
import { usePageNavigation } from "../hooks/usePageNavigation";
import { useReadingDirection } from "../hooks/useReadingDirection";
import { useViewerController } from "../hooks/useViewerController";
import type { ViewerSettings } from "../utils/ImageUtils";
import AdjacentBookConfirmDialog from "./AdjacentBookConfirmDialog";
import Loupe from "./Loupe";
import PageErrorMessage from "./PageErrorMessage";

/** What one place on the screen shows: the page, or why the page is not there. */
interface PageSlot {
  /** The blob URL of the page, once it has one. */
  url?: string;
  /** Why the page has no image, when it failed. */
  error?: ErrorCode;
}

/**
 * Draws one page of the reader: the image, or the reason it could not be loaded.
 *
 * @param page The page to draw.
 * @param alt The alt text naming the page's place on screen.
 * @param width How much of the reader the page fills.
 * @param objectPosition Which edge of its place the image is aligned to.
 * @returns The page, or null while it is still loading.
 */
const renderPage = (page: PageSlot, alt: string, width: string, objectPosition: string) => {
  if (page.url) {
    return (
      <Box
        component="img"
        src={page.url}
        alt={alt}
        sx={{ width, height: "100%", objectPosition, objectFit: "contain" }}
      />
    );
  }
  if (page.error !== undefined) {
    return <PageErrorMessage code={page.error} width={width} />;
  }
  return null;
};

const selectComicReaderState = createSelector(
  [(state: RootState) => state.read.containerFile, (state: RootState) => state.settings.reader],
  (containerFile, readerSettings) => ({
    history: containerFile.history,
    historyIndex: containerFile.historyIndex,
    entries: containerFile.entries,
    index: containerFile.index,
    isSpreadShifted: containerFile.isSpreadShifted,
    book: containerFile.book,
    readerSettings,
  }),
);

/**
 * Component for displaying images of comics.
 */
export default function ComicReader() {
  const dispatch = useAppDispatch();
  const { history, historyIndex, entries, index, isSpreadShifted, book, readerSettings } =
    useAppSelector(selectComicReaderState);

  const containerPath = history[historyIndex];

  const readingDirection = useReadingDirection();

  const settings: ViewerSettings = useMemo(
    () => ({
      isTwoPagedView: readerSettings.comic.enableSpread,
      isFirstPageSingleView: readerSettings.comic.showCoverAsSinglePage,
      direction: readingDirection,
      enablePreview: readerSettings.rendering.enableThumbnailPreview,
      preloadPageCount: readerSettings.comic.cache.preloadPageCount,
    }),
    [
      readerSettings.comic.enableSpread,
      readerSettings.comic.showCoverAsSinglePage,
      readingDirection,
      readerSettings.rendering.enableThumbnailPreview,
      readerSettings.comic.cache.preloadPageCount,
    ],
  );

  const { onForwardBoundary, onBackwardBoundary, pending, confirmPending, cancelPending } =
    useAdjacentBookNavigation();

  const { displayedLayout, moveForward, moveBack, isImageLoading } = useViewerController({
    containerPath,
    entries,
    index,
    isSpreadShifted,
    settings,
    dispatch,
    book,
    onForwardBoundary,
    onBackwardBoundary,
  });

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

  // The same navigation in both branches: with nothing on screen — a book still opening,
  // or a page that failed — turning the page is how the reader reaches one that works.
  const navigationHandlers = {
    onClick: handleClicked,
    onContextMenu: handleContextMenu,
    onWheel: handleWheeled,
  };

  const confirmDialog = (
    <AdjacentBookConfirmDialog
      open={pending != null}
      title={pending?.book.displayName}
      onConfirm={confirmPending}
      onCancel={cancelPending}
    />
  );

  if (!displayedLayout) {
    return (
      <Box
        tabIndex={0}
        {...navigationHandlers}
        data-testid="comic-reader-area"
        sx={{
          width: "100%",
          height: "100%",
        }}
      >
        {spinnerOverlay}
        {confirmDialog}
      </Box>
    );
  }

  const firstPage: PageSlot = {
    url: displayedLayout.firstImage?.url,
    error: displayedLayout.firstError,
  };
  const secondPage: PageSlot = {
    url: displayedLayout.secondImage?.url,
    error: displayedLayout.secondError,
  };
  // The pair is in reading order, the screen is not: in RTL the first page is the right one.
  const [leftPage, rightPage] =
    settings.direction === "ltr" ? [firstPage, secondPage] : [secondPage, firstPage];

  return (
    <Box
      tabIndex={0}
      {...navigationHandlers}
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
              {renderPage(leftPage, "Left Page", "50%", "right center")}
              {renderPage(rightPage, "Right Page", "50%", "left center")}
            </>
          ) : (
            renderPage(firstPage, "Single Page", "100%", "center center")
          )}
        </Box>
      </Loupe>
      {confirmDialog}
    </Box>
  );
}
