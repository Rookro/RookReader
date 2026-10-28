import { error, warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookWithState } from "../../../bindings/bindings";
import { requestPreloadAround, setDisplaySize } from "../../../bindings/ContainerCommands";
import type { AppDispatch } from "../../../store/store";
import { createCommandError, type ErrorCode } from "../../../types/Error";
import type { Image } from "../../../types/Image";
import { perf, perfSince, perfStart } from "../../../utils/perf";
import { setImageIndex, setSpreadDisplayed } from "../slice";
import {
  buildSinglePageLayout,
  buildUnitLayout,
  createImageCacheItem,
  fetchImageBlob,
  fetchImagePreviewBlob,
  type ImageCacheItem,
  revokeCacheItemUrls,
  SINGLE_UNIT,
  type UnitDecision,
  type ViewerSettings,
  type ViewLayout,
} from "../utils/ImageUtils";
import {
  assumedChainFrom,
  chainFrom,
  containingUnitStart,
  nextUnitStart,
  previousUnitStart,
  walkUnits,
} from "../utils/spreadPairing";
import type { DisplaySize } from "./useDisplaySize";
import { useLandscapeScan } from "./useLandscapeScan";
import type { PageMove, PageMoveOptions } from "./usePageNavigation";

/**
 * How long the viewer holds the loading state waiting to be told how the book pairs.
 *
 * Only a book being measured for the first time can reach it: after that the pairing
 * arrives with the book, and a measured 200-page book scans in 8 ms (ZIP) to 434 ms (a
 * solid RAR). One second is the limit for a flow of thought — past it, being able to read
 * beats being paired, so the viewer pairs from the setting alone and corrects itself if
 * the measurement disagrees.
 *
 * The cap is what keeps that correction rare, which is why it is not simply zero: showing
 * the assumed pairing immediately would guarantee a visible correction on the first open
 * of every book that has a landscape page.
 */
const CHAIN_WAIT_CAP_MS = 1000;

/**
 * Revokes every object URL held by the cache entries.
 *
 * @param cache - The image cache whose `previewUrl`/`fullUrl` object URLs should be revoked.
 */
const revokeCacheUrls = (cache: Map<string, ImageCacheItem>) => {
  cache.forEach(revokeCacheItemUrls);
};

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
  const cacheRef = useRef<Map<string, ImageCacheItem>>(new Map());
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [layoutState, setLayoutState] = useState<{ layout: ViewLayout; path: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Set once the viewer has waited CHAIN_WAIT_CAP_MS for a chain that has not arrived.
  const [chainWaitElapsed, setChainWaitElapsed] = useState(false);
  // The shape of the pages the viewer has loaded, which is all it knows about a book the
  // measurement has not described yet. Recorded only while that is the case, so a
  // measured book — every book after its first open — never pays for it.
  const [loadedLandscape, setLoadedLandscape] = useState<ReadonlyMap<string, boolean>>(new Map());
  // The viewport the backend has answered for, and the gate on loading anything.
  //
  // Not `displaySize` itself: the report is a round trip, and a page asked for before it
  // lands is rendered for whatever viewport the backend still had.
  const [reportedSize, setReportedSize] = useState<DisplaySize | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
    setLoadedLandscape(new Map());
    abortControllerRef.current?.abort();
  }, [containerPath]);

  // Revoke any remaining object URLs when the component unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      revokeCacheUrls(cache);
      cache.clear();
    };
  }, []);

  const landscape = useLandscapeScan({ containerPath, pageCount: entries.length, book });

  const chain = useMemo(() => {
    if (!landscape) {
      return null;
    }
    return chainFrom(landscape, settings, isSpreadShifted);
  }, [landscape, isSpreadShifted, settings]);

  /**
   * The pairing to show when the measurement has not arrived and the wait cap has passed.
   *
   * The book has offered no evidence *yet*, which is the case the settings tier of the
   * evidence order already covers: assume no page is landscape and let
   * `isFirstPageSingleView` decide, exactly as it would for a book that turns out to have
   * none. For such a book — most of them — this is already the final answer and the
   * measurement changes nothing when it lands.
   *
   * Where the book does have landscape pages, the measurement can move a spread boundary,
   * and the facing page changes under the reader. That is the cost of pairing at all
   * before the book has been measured; the page the reader is on stays on screen either
   * way, because the chain effect snaps to the unit containing it rather than past it.
   */
  const assumedChain = useMemo(
    () => assumedChainFrom(entries, loadedLandscape, settings, isSpreadShifted),
    [entries, loadedLandscape, isSpreadShifted, settings],
  );

  /**
   * The pairing everything downstream uses: the book's own once it is known, and the one
   * the settings imply once the viewer has waited long enough for it.
   *
   * Null only while the book is still being measured inside the wait cap, which is when
   * the viewer shows nothing rather than a pairing it would have to correct.
   *
   * Display, navigation and the boundary snap all read *this*, never `chain` directly.
   * They have to agree: a viewer that displays the spread {0,1} but steps forward by one
   * page shows page 1 again on its own, and the reader turns the page to re-read what
   * they just read.
   */
  const pairing = useMemo(
    () => chain ?? (chainWaitElapsed ? assumedChain : null),
    [chain, chainWaitElapsed, assumedChain],
  );

  // Hold the loading state until the book's pairing is known, then give up. Only a book
  // being measured for the first time can reach the cap.
  useEffect(() => {
    setChainWaitElapsed(false);
    if (chain) {
      return;
    }
    const timer = setTimeout(() => setChainWaitElapsed(true), CHAIN_WAIT_CAP_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [chain]);

  // The chain is the book's own pairing, so a page reached by a restore or a jump
  // (slider, bookmark, page list) may sit inside a unit rather than start one. Snap to
  // the unit that contains it: the page on screen stays on screen and only gains its
  // facing page. Never the other way round — where the reader entered the book must not
  // decide how the book is paired.
  useEffect(() => {
    if (!pairing) {
      return;
    }
    const start = containingUnitStart(pairing, index);
    if (start !== null) {
      dispatch(setImageIndex(start));
    }
  }, [pairing, index, dispatch]);

  // The unit the viewer is showing, which is also the unit navigation steps by. A single
  // page is the answer while no pairing is available at all, and for an index that is not
  // a unit start — the snap above is what normally settles that.
  const currentUnit = useCallback(
    (): UnitDecision => pairing?.units.get(index) ?? SINGLE_UNIT,
    [pairing, index],
  );

  // When the reader last asked for a different page, and whether they have been shown
  // one since.
  //
  // The layout effect below re-runs whenever the pairing changes as well, and on a book
  // whose measurement arrives late that re-run is the one that publishes — so a span
  // started there would time the re-run and miss the wait that preceded it, which is the
  // whole of what the reader experienced. Declared above that effect so it is reset
  // first on the render where the index changes.
  const askedRef = useRef<number | null>(null);
  const shownRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restart the wait whenever the reader asks for a different page.
  useEffect(() => {
    askedRef.current = perfStart();
    shownRef.current = false;
  }, [containerPath, index]);

  // Report the viewport, and release the load effect below once the backend has it.
  useEffect(() => {
    if (displaySize.width === 0 || displaySize.height === 0) {
      return;
    }
    let cancelled = false;
    setDisplaySize(displaySize.width, displaySize.height)
      .then(() => {
        if (cancelled) {
          return;
        }
        // The cached blob URLs are pages rendered for the previous viewport. Nothing
        // reloads them: the backend keys a page by the box it was fitted into, so they
        // would simply never be asked for again.
        revokeCacheUrls(cacheRef.current);
        cacheRef.current.clear();
      })
      .catch((e) => {
        // The backend still has whatever viewport it was last told, and a page rendered
        // for that beats no page at all, so the load is released either way — with the
        // cache kept, because it matches what the backend would serve.
        warn(`Failed to report the display size: ${String(e)}`);
      })
      .finally(() => {
        if (!cancelled) {
          setReportedSize(displaySize);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [displaySize]);

  // Loads the missing images and updates the layout.
  useEffect(() => {
    // Nothing is asked for until the backend has answered for the viewport: a page
    // fetched before that is rendered for the previous one and fetched again. The
    // reader is waiting on that round trip as much as on the page itself.
    if (!reportedSize) {
      setIsImageLoading(true);
      return;
    }

    const updateLayout = async () => {
      // Cancels previous request.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const pathsToLoad = [entries[index]];
      if (settings.isTwoPagedView && index + 1 < entries.length) {
        pathsToLoad.push(entries[index + 1]);
      }

      const cache = cacheRef.current;

      /** Reports the first page shown since the reader asked for this one. */
      const reportDisplayed = () => {
        if (shownRef.current) {
          return;
        }
        shownRef.current = true;
        const source = chain ? "chain" : "assumed";
        perf("display", `index=${index} pairing=${source}`, perfSince(askedRef.current) ?? 0);
      };

      // Why each page this run asked for could not be loaded, for the pages that failed.
      // The reader is told in the failed page's own place, which is what says *which*
      // page failed, so this travels in the layout rather than as viewer-wide state.
      const failures = new Map<string, ErrorCode>();

      /**
       * Builds the layout for the current index, once a pairing is available.
       *
       * Display is gated on the pairing; loading is not. `pathsToLoad` above is built
       * from the index and the two-page setting, never from the unit, so both pages are
       * already decoded when the chain lands and the hold costs waiting, not latency.
       */
      const layoutForCurrentIndex = (): ViewLayout | null =>
        pairing ? buildUnitLayout(currentUnit(), index, entries, cache, failures) : null;

      // Tracks whether a full layout was resolved this run, so the post-settle
      // fallback only fires when no layout ever came out.
      let layoutResolved = false;

      /** Shows the current index's unit as soon as every page in it is settled. */
      const publishLayout = () => {
        const layout = layoutForCurrentIndex();
        if (layout) {
          layoutResolved = true;
          reportDisplayed();
          setLayoutState({ layout, path: containerPath });
        }
      };

      const loadAndUpdate = async (
        path: string,
        fetcher: (containerPath: string, entryName: string) => Promise<Image | null | undefined>,
        isPreview: boolean,
      ) => {
        if (controller.signal.aborted) return;
        let img: Image | null | undefined;
        try {
          img = await fetcher(containerPath, path);
        } catch (e) {
          const commandError = createCommandError(e);
          error(
            `Failed to load ${isPreview ? "a preview" : "an image"} of ${path}: ` +
              `${commandError.message} (code ${commandError.code})`,
          );
          // A preview is answered by the full image that follows it, so only the page
          // itself failing is worth putting on screen.
          if (!isPreview && !controller.signal.aborted) {
            failures.set(path, commandError.code);
            publishLayout();
          }
          return;
        }
        if (img && !controller.signal.aborted) {
          const newItem = createImageCacheItem(img, isPreview);
          // A full page's own dimensions are the one thing the viewer can know about an
          // unmeasured book. A preview is not that page: its format chose its size.
          if (!isPreview && !chain) {
            setLoadedLandscape((known) =>
              known.has(path) ? known : new Map(known).set(path, newItem.width > newItem.height),
            );
          }
          const existingItem = cache.get(path);
          if (existingItem) {
            if (isPreview) {
              existingItem.previewUrl = newItem.previewUrl;
            } else {
              existingItem.fullUrl = newItem.fullUrl;
            }
          } else {
            cache.set(path, newItem);
          }
          publishLayout();
        }
      };

      const missingFullPaths = pathsToLoad.filter((p) => !cache.get(p)?.fullUrl);
      if (missingFullPaths.length === 0) {
        setIsImageLoading(pairing === null);
        const layout = layoutForCurrentIndex();
        if (layout) {
          reportDisplayed();
        }
        setLayoutState(layout ? { layout, path: containerPath } : null);
        return;
      }

      setIsImageLoading(true);

      const missingPreviewPaths =
        settings.enablePreview && hasPreviews
          ? pathsToLoad.filter((p) => !cache.get(p)?.previewUrl)
          : [];

      const previewPromises = missingPreviewPaths.map((path) =>
        loadAndUpdate(path, fetchImagePreviewBlob, true),
      );
      const fullPromises = missingFullPaths.map((path) =>
        loadAndUpdate(path, fetchImageBlob, false),
      );

      // Wait for previews first (if any are needed) to display something quickly
      if (previewPromises.length > 0) {
        await Promise.all(previewPromises);

        if (!controller.signal.aborted) {
          setIsImageLoading(pairing === null);
        }
      }

      // Continue fetching full-res images in the background
      await Promise.all(fullPromises);

      if (!controller.signal.aborted) {
        // Loading has settled. If no full layout resolved (e.g. a spread's second page
        // failed to load), degrade to a single-page layout for the first image instead of
        // leaving the viewer blank. Only once the pairing is known, though: a single page
        // published while it is not is exactly the guess the hold exists to avoid.
        if (!layoutResolved && pairing) {
          const firstImg = cache.get(entries[index]);
          if (firstImg) {
            reportDisplayed();
            setLayoutState({ layout: buildSinglePageLayout(firstImg), path: containerPath });
          }
        }
        if (previewPromises.length === 0) {
          setIsImageLoading(pairing === null);
        }
      }
    };

    updateLayout();

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [
    containerPath,
    index,
    entries,
    settings,
    hasPreviews,
    currentUnit,
    pairing,
    chain,
    reportedSize,
  ]);

  // Request preloading around the current index in the backend.
  //
  // Gated on the viewport like the load effect, and re-run when it changes: a preload
  // issued before the backend has the viewport fills the cache with pages rendered for
  // the previous one, and the backend drops the preload jobs still queued for a
  // viewport the reader has left only when it is asked to preload for the new one.
  useEffect(() => {
    if (entries.length > 0 && reportedSize) {
      // The same pages the layout effect above loads, named so the backend leaves them
      // to the foreground requests already on their way.
      const callerPages = settings.isTwoPagedView && index + 1 < entries.length ? 2 : 1;
      requestPreloadAround(containerPath, index, settings.preloadPageCount, callerPages).catch(
        (e) => {
          warn(`Failed to request preload: ${String(e)}`);
        },
      );
    }
  }, [
    containerPath,
    index,
    settings.preloadPageCount,
    settings.isTwoPagedView,
    entries.length,
    reportedSize,
  ]);

  // Evict cached pages outside a window around the current index so long sessions
  // don't retain every visited page's blob URLs (unbounded renderer memory). The
  // window always contains the current spread (index, index + 1) and the backend
  // preload range, so backtrack re-fetches hit the backend LRU cache.
  useEffect(() => {
    const radius = Math.max(settings.preloadPageCount, 5);
    const keep = new Set(entries.slice(Math.max(0, index - radius), index + radius + 1));
    for (const [key, item] of cacheRef.current) {
      if (!keep.has(key)) {
        revokeCacheItemUrls(item);
        cacheRef.current.delete(key);
      }
    }
  }, [index, entries, settings.preloadPageCount]);

  const displayedLayout = layoutState?.path === containerPath ? layoutState?.layout : null;

  // Publish what is actually on screen so the page list can highlight both pages of a
  // spread. Driven by the resolved layout rather than the unit decision, so a spread
  // that degraded to a single page is reported as one page.
  const isSpreadDisplayed = displayedLayout?.isSpread ?? false;
  useEffect(() => {
    dispatch(setSpreadDisplayed(isSpreadDisplayed));
  }, [isSpreadDisplayed, dispatch]);

  const goTo = useCallback(
    (nextIndex: number) => {
      dispatch(setImageIndex(nextIndex));
    },
    [dispatch],
  );

  // The index one displayed unit after `i`, or null past the last page. Derive the
  // increment from the unit at `i`, not the lagging displayedLayout, which would desync
  // spread pairs / skip pages. The unit is the one being displayed, so a step never lands
  // on a page the reader has just seen, and a unit chain covers every index contiguously,
  // so it never skips one either.
  const nextIndexFrom = useCallback(
    (i: number): number | null => nextUnitStart(pairing, i, entries.length),
    [pairing, entries.length],
  );

  // The index one displayed unit before `i`, or null on the first page. The preceding unit
  // is the last boundary before `i` of the pairing the viewer is displaying, so back and
  // forward stay in step; without a pairing every unit is a single page.
  const previousIndexFrom = useCallback(
    (i: number): number | null => previousUnitStart(pairing, i, settings.isTwoPagedView),
    [settings.isTwoPagedView, pairing],
  );

  const walk = useCallback(
    (
      step: (i: number) => number | null,
      boundary: (() => void) | undefined,
      options?: PageMoveOptions,
    ): boolean => {
      if (entries.length === 0) {
        return false;
      }
      const steps = options?.steps ?? 1;
      const { at, moved } = walkUnits(index, steps, step);
      if (moved > 0) {
        goTo(at);
      } else if (options?.crossBook !== false) {
        // Already at the first or last page: hand off to the adjacent-book handler.
        boundary?.();
      }
      return moved === steps;
    },
    [entries.length, index, goTo],
  );

  const moveForward = useCallback(
    (options?: PageMoveOptions) => walk(nextIndexFrom, onForwardBoundary, options),
    [walk, nextIndexFrom, onForwardBoundary],
  );

  const moveBack = useCallback(
    (options?: PageMoveOptions) => walk(previousIndexFrom, onBackwardBoundary, options),
    [walk, previousIndexFrom, onBackwardBoundary],
  );

  return {
    displayedLayout,
    isImageLoading,
    moveForward,
    moveBack,
  };
};
