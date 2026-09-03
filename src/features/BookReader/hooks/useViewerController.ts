import { warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updatePageLayout } from "../../../bindings/BookCommands";
import type { BookWithState } from "../../../bindings/bindings";
import { getImageDimensions, requestPreloadAround } from "../../../bindings/ContainerCommands";
import type { AppDispatch } from "../../../store/store";
import type { Image } from "../../../types/Image";
import { setImageIndex, setSpreadDisplayed } from "../slice";
import {
  buildSinglePageLayout,
  buildUnitChain,
  buildUnitLayout,
  createImageCacheItem,
  detectCoverPresence,
  fetchImageBlob,
  fetchImagePreviewBlob,
  type ImageCacheItem,
  revokeCacheItemUrls,
  SINGLE_UNIT,
  type UnitDecision,
  type ViewerSettings,
  type ViewLayout,
} from "../utils/ImageUtils";

/**
 * How long the viewer holds the loading state waiting to be told how the book pairs.
 *
 * Only a book being measured for the first time can reach it: after that the pairing
 * arrives with the book. One second is the limit for a flow of thought — past it, being
 * able to read beats being paired, so the viewer falls back to single pages.
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
  /** Move forward action. */
  moveForward: () => void;
  /** Move backward action. */
  moveBack: () => void;
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
  dispatch,
  book,
  onForwardBoundary,
  onBackwardBoundary,
}: ViewerControllerOptions): ViewerController => {
  const cacheRef = useRef<Map<string, ImageCacheItem>>(new Map());
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [layoutState, setLayoutState] = useState<{ layout: ViewLayout; path: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [scannedLandscape, setScannedLandscape] = useState<{
    path: string;
    landscape: boolean[];
  } | null>(null);
  // Set once the viewer has waited CHAIN_WAIT_CAP_MS for a chain that has not arrived.
  const [chainWaitElapsed, setChainWaitElapsed] = useState(false);
  // The book whose measurement has already been written back, so a re-render cannot
  // write it twice.
  const savedLayoutRef = useRef<string | null>(null);
  // Set once this book answers a preview request with "no preview". Only a container that
  // can build a small image more cheaply than the page itself has one to give, so for
  // every image format the answer is no — and asking again for every page turn buys
  // nothing but a round trip. One wasted request per book settles it.
  const previewUnsupportedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
    previewUnsupportedRef.current = false;
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

  // The book as already measured, when the stored bits describe *this* book. Bits of a
  // different length belong to a book whose pages have changed since.
  const cachedLandscape = useMemo(() => {
    const bits = book?.landscape_bits;
    return bits && bits.length === entries.length ? Array.from(bits, (bit) => bit === "1") : null;
  }, [book, entries.length]);

  // Measure the book, unless it already carries its measurement. Skipping the scan for a
  // known book is what takes a full re-measure off every reopen.
  useEffect(() => {
    setScannedLandscape(null);
    if (!containerPath || entries.length === 0 || cachedLandscape) {
      return;
    }

    let cancelled = false;
    getImageDimensions(containerPath)
      .then((dims) => {
        if (!cancelled) {
          setScannedLandscape({
            path: containerPath,
            landscape: dims.map((page) => page.width > page.height),
          });
        }
      })
      .catch((e) => {
        warn(`Failed to scan image dimensions: ${String(e)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [containerPath, entries.length, cachedLandscape]);

  // One value, two origins. A scan belonging to another book, or reporting a different
  // page count, is ignored: it cannot describe this one.
  const landscape = useMemo(() => {
    if (cachedLandscape) {
      return cachedLandscape;
    }
    if (
      !scannedLandscape ||
      scannedLandscape.path !== containerPath ||
      scannedLandscape.landscape.length !== entries.length
    ) {
      return null;
    }
    return scannedLandscape.landscape;
  }, [cachedLandscape, scannedLandscape, containerPath, entries.length]);

  const chain = useMemo(() => {
    if (!landscape) {
      return null;
    }
    // The archive's own landscape pages prove whether it carries the cover, so they
    // outrank `isFirstPageSingleView`, which is only a default for archives that offer
    // no proof. The reader's toggle outranks both, so the button always changes the
    // chain — including when a landscape page would otherwise decide it.
    const base = detectCoverPresence(landscape) ?? settings.isFirstPageSingleView;
    return buildUnitChain(landscape, settings, isSpreadShifted ? !base : base);
  }, [landscape, isSpreadShifted, settings]);

  // Remember the measurement so this book never has to be scanned again. Only a fully
  // successful scan is written back: a page that failed once, and so measured as 0x0,
  // must not fix the book's pairing forever.
  useEffect(() => {
    const id = book?.id;
    if (
      id === undefined ||
      !scannedLandscape ||
      scannedLandscape.path !== containerPath ||
      scannedLandscape.landscape.length !== entries.length ||
      savedLayoutRef.current === containerPath
    ) {
      return;
    }
    savedLayoutRef.current = containerPath;
    const bits = scannedLandscape.landscape.map((bit) => (bit ? "1" : "0")).join("");
    updatePageLayout(id, bits).catch((e: unknown) => {
      warn(`Failed to store the page layout: ${String(e)}`);
    });
  }, [book, scannedLandscape, containerPath, entries.length]);

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
    if (!chain) {
      return;
    }
    if (!chain.units.has(index)) {
      const start = chain.starts.filter((s) => s < index).at(-1);
      if (start !== undefined) {
        dispatch(setImageIndex(start));
      }
    }
  }, [chain, index, dispatch]);

  // Single pages until the book has been measured. A provisional pairing would be a coin
  // flip on parity, and correcting it swaps the facing page under the reader; falling
  // back to single pages means the settled chain can only add one.
  const currentUnit = useCallback(
    (): UnitDecision => chain?.units.get(index) ?? SINGLE_UNIT,
    [chain, index],
  );

  // Loads the missing images and updates the layout.
  useEffect(() => {
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

      // Whether the viewer may show anything yet. A book being measured for the first
      // time is the only one that reaches this false, and it becomes true either when the
      // chain lands or when the wait cap gives up on it.
      const pairingKnown = chain !== null || chainWaitElapsed;

      /**
       * Builds the layout for the current index, once the book's pairing is settled.
       *
       * Display is gated on the pairing; loading is not. `pathsToLoad` above is built
       * from the index and the two-page setting, never from the unit, so both pages are
       * already decoded when the chain lands and the hold costs waiting, not latency.
       */
      const layoutForCurrentIndex = (): ViewLayout | null =>
        pairingKnown ? buildUnitLayout(currentUnit(), index, entries, cache) : null;

      // Tracks whether a full layout was resolved this run, so the post-settle
      // fallback only fires when no layout ever came out.
      let layoutResolved = false;

      const loadAndUpdate = async (
        path: string,
        fetcher: (containerPath: string, entryName: string) => Promise<Image | null | undefined>,
        isPreview: boolean,
      ) => {
        if (controller.signal.aborted) return;
        const img = await fetcher(containerPath, path);
        // Null is the backend declining, not a failure: only that answer is evidence
        // about the container.
        if (isPreview && img === null && !controller.signal.aborted) {
          previewUnsupportedRef.current = true;
        }
        if (img && !controller.signal.aborted) {
          const newItem = createImageCacheItem(img, isPreview);
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
          const layout = layoutForCurrentIndex();
          if (layout) {
            layoutResolved = true;
            setLayoutState({ layout, path: containerPath });
          }
        }
      };

      const missingFullPaths = pathsToLoad.filter((p) => !cache.get(p)?.fullUrl);
      if (missingFullPaths.length === 0) {
        setIsImageLoading(!pairingKnown);
        const layout = layoutForCurrentIndex();
        setLayoutState(layout ? { layout, path: containerPath } : null);
        return;
      }

      setIsImageLoading(true);

      const missingPreviewPaths =
        settings.enablePreview && !previewUnsupportedRef.current
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
          setIsImageLoading(!pairingKnown);
        }
      }

      // Continue fetching full-res images in the background
      await Promise.all(fullPromises);

      if (!controller.signal.aborted) {
        // Loading has settled. If no full layout resolved (e.g. a spread's second page
        // failed to load), degrade to a single-page layout for the first image instead of
        // leaving the viewer blank. Only once the pairing is known, though: a single page
        // published while it is not is exactly the guess the hold exists to avoid.
        if (!layoutResolved && pairingKnown) {
          const firstImg = cache.get(entries[index]);
          if (firstImg) {
            setLayoutState({ layout: buildSinglePageLayout(firstImg), path: containerPath });
          }
        }
        if (previewPromises.length === 0) {
          setIsImageLoading(!pairingKnown);
        }
      }
    };

    updateLayout();

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [containerPath, index, entries, settings, currentUnit, chain, chainWaitElapsed]);

  // Request preloading around the current index in the backend.
  useEffect(() => {
    if (entries.length > 0) {
      requestPreloadAround(containerPath, index, settings.preloadPageCount).catch((e) => {
        warn(`Failed to request preload: ${String(e)}`);
      });
    }
  }, [containerPath, index, settings.preloadPageCount, entries.length]);

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

  const moveForward = useCallback(() => {
    if (entries.length === 0) {
      return;
    }

    // Derive the increment from the current index's unit, not the lagging
    // displayedLayout, which would desync spread pairs / skip pages.
    // When the unit is unknown (dimensions not known yet) advance by 1: advancing 2
    // could skip a page permanently, while a transient half-spread self-corrects.
    const increment = currentUnit()?.nextIndexIncrement ?? 1;
    const nextIndex = index + increment;

    if (nextIndex < entries.length) {
      goTo(nextIndex);
    } else {
      // Already at the last page: hand off to the adjacent-book handler.
      onForwardBoundary?.();
    }
  }, [index, entries, goTo, currentUnit, onForwardBoundary]);

  const moveBack = useCallback(() => {
    if (entries.length === 0) {
      return;
    }

    if (index === 0) {
      // Already at the first page: hand off to the adjacent-book handler.
      onBackwardBoundary?.();
      return;
    }

    if (!settings.isTwoPagedView) {
      goTo(index - 1);
      return;
    }

    // With the whole book measured, the preceding unit is simply the last boundary
    // before the current index.
    if (chain) {
      const previous = chain.starts.filter((start) => start < index).at(-1);
      if (previous !== undefined) {
        goTo(previous);
        return;
      }
    }

    // Without a chain every unit is a single page, so one step back is the whole answer.
    goTo(index - 1);
  }, [index, entries.length, settings, goTo, chain, onBackwardBoundary]);

  return {
    displayedLayout,
    isImageLoading,
    moveForward,
    moveBack,
  };
};
