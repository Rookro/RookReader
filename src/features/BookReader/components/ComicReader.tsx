import { Box, CircularProgress } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useEffect, useMemo, useState } from "react";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { useAdjacentBookNavigation } from "../hooks/useAdjacentBookNavigation";
import { useDisplaySize } from "../hooks/useDisplaySize";
import { useFullSizePages } from "../hooks/useFullSizePages";
import { useLoupe } from "../hooks/useLoupe";
import { usePageNavigation } from "../hooks/usePageNavigation";
import { useReadingDirection } from "../hooks/useReadingDirection";
import { useViewerController } from "../hooks/useViewerController";
import { useRegisterReaderActions } from "../input/ReaderInputContext";
import type { ViewerSettings } from "../utils/ImageUtils";
import { OBJECT_POSITION, type PageSlot, pageSlots, SLOT_ALT } from "../utils/pageSlots";
import AdjacentBookConfirmDialog from "./AdjacentBookConfirmDialog";
import Loupe from "./Loupe";
import PageErrorMessage from "./PageErrorMessage";

/**
 * Draws one slot of the reader: the image, or the reason it could not be loaded.
 *
 * @param slot The slot describing the page's place and alignment.
 * @param url The image URL to draw in this slot, if any.
 * @returns The page element, or null while it is still loading.
 */
const renderPage = (slot: PageSlot, url: string | undefined) => {
  const width = `${slot.width * 100}%`;
  if (url) {
    return (
      <Box
        key={slot.role}
        component="img"
        src={url}
        alt={SLOT_ALT[slot.role]}
        sx={{
          width,
          height: "100%",
          objectPosition: OBJECT_POSITION[slot.align],
          objectFit: "contain",
        }}
      />
    );
  }
  if (slot.error !== undefined) {
    return <PageErrorMessage key={slot.role} code={slot.error} width={width} />;
  }
  return null;
};

const selectComicReaderState = createSelector(
  [(state: RootState) => state.reader, (state: RootState) => state.settings.reader],
  (reader, readerSettings) => ({
    history: reader.history,
    historyIndex: reader.historyIndex,
    entries: reader.entries,
    index: reader.index,
    isSpreadShifted: reader.isSpreadShifted,
    hasPreviews: reader.hasPreviews,
    book: reader.book,
    readerSettings,
  }),
);

/**
 * Component for displaying images of comics.
 */
export default function ComicReader() {
  const dispatch = useAppDispatch();
  const {
    history,
    historyIndex,
    entries,
    index,
    isSpreadShifted,
    hasPreviews,
    book,
    readerSettings,
  } = useAppSelector(selectComicReaderState);

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

  const { isLoupeEnabled, loupePos, containerRef, handleMouseMove, toggleLoupe } =
    useLoupe(containerPath);
  const displaySize = useDisplaySize(containerRef);

  const { displayedLayout, moveForward, moveBack, moveToFirst, moveToLast, isImageLoading } =
    useViewerController({
      containerPath,
      entries,
      index,
      isSpreadShifted,
      settings,
      hasPreviews,
      displaySize,
      dispatch,
      book,
      onForwardBoundary,
      onBackwardBoundary,
    });

  const loupeSettings = readerSettings.comic.loupe;

  const firstDisplayedEntry = displayedLayout?.firstImage ? displayedLayout.firstEntry : undefined;
  const secondDisplayedEntry = displayedLayout?.secondImage
    ? displayedLayout.secondEntry
    : undefined;
  const shownEntries = useMemo(
    () =>
      [firstDisplayedEntry, secondDisplayedEntry].filter(
        (entry): entry is string => entry !== undefined,
      ),
    [firstDisplayedEntry, secondDisplayedEntry],
  );
  const fullSizeUrls = useFullSizePages(
    containerPath,
    shownEntries,
    loupeSettings.zoom,
    isLoupeEnabled,
  );

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

  useRegisterReaderActions(
    {
      nextPage: moveForward,
      previousPage: moveBack,
      firstPage: moveToFirst,
      lastPage: moveToLast,
      toggleLoupe,
    },
    containerRef,
  );
  const { handleClicked, handleContextMenu, handleWheeled } = usePageNavigation();

  // `showSpinner` is cleared only by the effect after loading stops: still true from the
  // last book on the render that opens the next.
  const spinnerOverlay =
    showSpinner && isImageLoading ? (
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

  const pages = () => {
    if (!displayedLayout) {
      return spinnerOverlay;
    }

    const slots = pageSlots(displayedLayout, settings.direction);

    /**
     * The pages as one pane, taking each slot's URL from `urlFor`.
     *
     * Written once and called twice: the lens shows the same pages in the same places
     * as the reader, only magnified, so anything the two did differently would be visible
     * as the lens passing over a page.
     */
    const pane = (urlFor: (slot: PageSlot) => string | undefined) => (
      <Box sx={{ display: "flex", width: "100%", height: "100%" }}>
        {spinnerOverlay}
        {slots.map((slot) => renderPage(slot, urlFor(slot)))}
      </Box>
    );

    return (
      <Loupe
        isLoupeEnabled={isLoupeEnabled}
        loupePos={loupePos}
        containerRef={containerRef}
        zoom={loupeSettings.zoom}
        radius={loupeSettings.radius}
        magnified={
          // A page whose magnified copy has not arrived falls back to the displayed one:
          // softer under the lens, never blank.
          fullSizeUrls.size > 0
            ? pane((slot) => (slot.entry && fullSizeUrls.get(slot.entry)) ?? slot.url)
            : undefined
        }
      >
        {pane((slot) => slot.url)}
      </Loupe>
    );
  };

  // One root whether or not a page is on screen: the reader area has to be measured
  // before the first page is asked for, and a second root would leave the size observer
  // watching the node React swapped out. The dialog sits beside that root: it renders
  // through a portal, but React events bubble along the component tree, so inside the
  // root its clicks and wheel would turn the page behind it.
  return (
    <>
      <Box
        tabIndex={0}
        {...navigationHandlers}
        onMouseMove={handleMouseMove}
        ref={containerRef}
        data-testid="comic-reader-area"
        sx={{
          width: "100%",
          height: "100%",
        }}
      >
        {pages()}
      </Box>
      {confirmDialog}
    </>
  );
}
