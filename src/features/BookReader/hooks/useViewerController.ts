import { useEffect } from "react";
import type { BookWithState } from "../../../bindings/bindings";
import type { AppDispatch } from "../../../store/store";
import { setSpreadDisplayed } from "../slice";
import type { ViewerSettings, ViewLayout } from "../utils/ImageUtils";
import type { DisplaySize } from "./useDisplaySize";
import { useLandscapeScan } from "./useLandscapeScan";
import { usePageCache } from "./usePageCache";
import { usePageLoader } from "./usePageLoader";
import type { PageMove } from "./usePageNavigation";
import { useSpreadNavigation } from "./useSpreadNavigation";
import { useSpreadPairing } from "./useSpreadPairing";

/**
 * ViewerController hook return type.
 */
export interface ViewerController {
  /** Layout to display. */
  displayedLayout: ViewLayout | null;
  /** Is loading a image. */
  isImageLoading: boolean;
  /** Moves forward by displayed units; returns false when it stopped short. */
  moveForward: PageMove;
  /** Moves back by displayed units; returns false when it stopped short. */
  moveBack: PageMove;
}

/** What {@link useViewerController} needs to drive the viewer. */
export interface ViewerControllerOptions {
  /** The path of the container file. */
  containerPath: string;
  /** Entries in the container. */
  entries: string[];
  /** Index of the current image. */
  index: number;
  /** Whether this book's spread pairing is shifted by one. */
  isSpreadShifted: boolean;
  /** Viewer settings. */
  settings: ViewerSettings;
  /** Whether the open book can send a page's preview more cheaply than the page. */
  hasPreviews: boolean;
  /**
   * How large the reader draws a page, in device pixels.
   *
   * Pages are rendered to fit it, so nothing is loaded until it has been measured and
   * the backend has been told: a page fetched before that would arrive at its stored
   * size and be fetched again at the right one.
   */
  displaySize: DisplaySize;
  /** Dispatch function from Redux. */
  dispatch: AppDispatch;
  /**
   * The open book's record, when it has one.
   *
   * Carries the measurement that decides how the book pairs, and the id to write a fresh
   * one back under. Null only when the book could not be recorded, in which case the
   * pairing is worked out again next time.
   */
  book?: BookWithState | null;
  /** Called when moving forward past the last page. */
  onForwardBoundary?: () => void;
  /** Called when moving back before the first page. */
  onBackwardBoundary?: () => void;
}

/**
 * Hooks for controlling the image viewer.
 *
 * Takes an options object rather than a positional list: at seven parameters the next
 * one would touch every call site again, and the one after that would too.
 *
 * @param options See {@link ViewerControllerOptions}.
 * @returns ViewerController.
 */
export const useViewerController = ({
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
}: ViewerControllerOptions): ViewerController => {
  const { cache, reportedSize } = usePageCache({
    containerPath,
    entries,
    index,
    preloadPageCount: settings.preloadPageCount,
    displaySize,
  });
  const landscape = useLandscapeScan({ containerPath, pageCount: entries.length, book });
  const { chain, pairing, recordLoadedPage } = useSpreadPairing({
    containerPath,
    entries,
    landscape,
    settings,
    isSpreadShifted,
    index,
    dispatch,
  });
  const { displayedLayout, isImageLoading } = usePageLoader({
    containerPath,
    entries,
    index,
    settings,
    hasPreviews,
    cache,
    reportedSize,
    chain,
    pairing,
    recordLoadedPage,
  });

  // Publish what is actually on screen so the page list can highlight both pages of a
  // spread. Driven by the resolved layout rather than the unit decision, so a spread
  // that degraded to a single page is reported as one page.
  const isSpreadDisplayed = displayedLayout?.isSpread ?? false;
  useEffect(() => {
    dispatch(setSpreadDisplayed(isSpreadDisplayed));
  }, [isSpreadDisplayed, dispatch]);

  const { moveForward, moveBack } = useSpreadNavigation({
    pairing,
    pageCount: entries.length,
    index,
    isTwoPagedView: settings.isTwoPagedView,
    dispatch,
    onForwardBoundary,
    onBackwardBoundary,
  });

  return {
    displayedLayout,
    isImageLoading,
    moveForward,
    moveBack,
  };
};
