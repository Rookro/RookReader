import { Box, CircularProgress } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { useEffect, useMemo, useRef, useState } from "react";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { useAdjacentBookNavigation } from "../hooks/useAdjacentBookNavigation";
import { useDisplaySize } from "../hooks/useDisplaySize";
import { useLoupe } from "../hooks/useLoupe";
import { useMagnifiedPages } from "../hooks/useMagnifiedPages";
import { usePageNavigation } from "../hooks/usePageNavigation";
import { useReadingDirection } from "../hooks/useReadingDirection";
import { useViewerController } from "../hooks/useViewerController";
import { useRegisterReaderActions } from "../input/ReaderInputContext";
import type { ViewerSettings } from "../utils/ImageUtils";
import {
  OBJECT_POSITION,
  type PageSlot,
  pageSlots,
  SLOT_ALT,
  type SlotRole,
} from "../utils/pageSlots";
import AdjacentBookConfirmDialog from "./AdjacentBookConfirmDialog";
import Loupe, { type LensPage } from "./Loupe";
import PageErrorMessage from "./PageErrorMessage";

/**
 * Draws one slot of the reader: the image, or the reason it could not be loaded.
 *
 * @param slot The slot describing the page's place and alignment.
 * @param imageRefs Map populated with each slot's mounted `<img>` element for the loupe.
 * @param onImageLoad Called when the displayed `<img>` finishes loading, so the loupe can redraw.
 * @returns The page element, or null while it is still loading.
 */
const renderPage = (
  slot: PageSlot,
  imageRefs: Map<SlotRole, HTMLImageElement>,
  onImageLoad: () => void,
) => {
  const width = `${slot.width * 100}%`;
  if (slot.url) {
    return (
      <Box
        key={slot.role}
        component="img"
        ref={(element: HTMLImageElement | null) => {
          if (element) imageRefs.set(slot.role, element);
          else imageRefs.delete(slot.role);
        }}
        src={slot.url}
        alt={SLOT_ALT[slot.role]}
        onLoad={onImageLoad}
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

  const { isLoupeEnabled, containerRef, handleMouseMove, toggleLoupe, lens } =
    useLoupe(containerPath);
  const displaySize = useDisplaySize(containerRef);
  const imageRefs = useRef(new Map<SlotRole, HTMLImageElement>());

  const {
    displayedLayout,
    reportedSize,
    moveForward,
    moveBack,
    moveToFirst,
    moveToLast,
    isImageLoading,
  } = useViewerController({
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
  const magnified = useMagnifiedPages(
    containerPath,
    firstDisplayedEntry,
    secondDisplayedEntry,
    loupeSettings.zoom,
    reportedSize,
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

  const slots = useMemo(
    () => (displayedLayout ? pageSlots(displayedLayout, settings.direction) : []),
    [displayedLayout, settings.direction],
  );
  const lensPages = useMemo<LensPage[]>(
    () =>
      slots
        .filter((slot) => slot.url !== undefined)
        .map((slot) => ({
          slot,
          displayed: () => imageRefs.current.get(slot.role),
          magnified: slot.entry ? magnified.get(slot.entry) : undefined,
        })),
    [slots, magnified],
  );

  const pages = () => {
    if (!displayedLayout) {
      return spinnerOverlay;
    }

    return (
      <Loupe
        isLoupeEnabled={isLoupeEnabled}
        lens={lens}
        pages={lensPages}
        zoom={loupeSettings.zoom}
        radius={loupeSettings.radius}
      >
        <Box sx={{ display: "flex", width: "100%", height: "100%" }}>
          {spinnerOverlay}
          {slots.map((slot) => renderPage(slot, imageRefs.current, lens.drawNow))}
        </Box>
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
