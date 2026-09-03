import { warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getImageDimensions, requestPreloadAround } from "../../../bindings/ContainerCommands";
import type { AppDispatch } from "../../../store/store";
import type { Image } from "../../../types/Image";
import { setImageIndex, setSpreadDisplayed, setSpreadShifted } from "../slice";
import {
  buildSinglePageLayout,
  buildUnitChain,
  buildUnitLayout,
  createImageCacheItem,
  detectCoverPresence,
  fetchImageBlob,
  fetchImagePreviewBlob,
  findPreviousUnitStart,
  type ImageCacheItem,
  type PageDims,
  resolveUnit,
  revokeCacheItemUrls,
  type UnitDecision,
  type ViewerSettings,
  type ViewLayout,
} from "../utils/ImageUtils";

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
  onForwardBoundary,
  onBackwardBoundary,
}: ViewerControllerOptions): ViewerController => {
  const cacheRef = useRef<Map<string, ImageCacheItem>>(new Map());
  // Dimensions are kept apart from the blob cache: they are tiny, and navigation needs
  // them for pages whose blobs have already been evicted.
  const dimsRef = useRef<Map<string, PageDims>>(new Map());
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [layoutState, setLayoutState] = useState<{ layout: ViewLayout; path: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [scannedDims, setScannedDims] = useState<{ path: string; dims: PageDims[] } | null>(null);
  // The book whose restored page has already been checked against the natural pairing.
  const adoptedPathRef = useRef<string | null>(null);
  // Set once this book answers a preview request with "no preview". Only a container that
  // can build a small image more cheaply than the page itself has one to give, so for
  // every image format the answer is no — and asking again for every page turn buys
  // nothing but a round trip. One wasted request per book settles it.
  const previewUnsupportedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
    dimsRef.current.clear();
    previewUnsupportedRef.current = false;
    abortControllerRef.current?.abort();
  }, [containerPath]);

  // Revoke any remaining object URLs when the component unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    const dims = dimsRef.current;
    return () => {
      revokeCacheUrls(cache);
      cache.clear();
      dims.clear();
    };
  }, []);

  // Scan every page's dimensions in the background. Until it lands (or if it fails) the
  // viewer runs on the dimensions of the pages it has actually loaded.
  useEffect(() => {
    setScannedDims(null);
    if (!containerPath || entries.length === 0) {
      return;
    }

    let cancelled = false;
    getImageDimensions(containerPath)
      .then((dims) => {
        if (!cancelled) {
          setScannedDims({ path: containerPath, dims });
        }
      })
      .catch((e) => {
        warn(`Failed to scan image dimensions: ${String(e)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [containerPath, entries.length]);

  const chain = useMemo(() => {
    if (!scannedDims || scannedDims.path !== containerPath) {
      return null;
    }
    // A short or stale scan cannot describe this book; keep the fallback instead.
    if (scannedDims.dims.length !== entries.length) {
      return null;
    }
    // The archive's own landscape pages prove whether it carries the cover, so they
    // outrank `isFirstPageSingleView`, which is only a default for archives that offer
    // no proof. The reader's toggle outranks both, so the button always changes the
    // chain — including when a landscape page would otherwise decide it.
    const base = detectCoverPresence(scannedDims.dims) ?? settings.isFirstPageSingleView;
    const hasCover = isSpreadShifted ? !base : base;
    return buildUnitChain(scannedDims.dims, settings, hasCover);
  }, [scannedDims, containerPath, isSpreadShifted, entries, settings]);

  // Two jobs, in order, both of which need a chain to exist.
  //
  // On the first chain for a book: if the restored page is not a boundary of the book's
  // natural pairing, the reader had deliberately shifted it, so shift it again. This is
  // what carries a shift across sessions without persisting anything of its own. For a
  // well-formed book the restored page is already a boundary and nothing happens.
  //
  // Afterwards: a page reached by a jump (slider, bookmark, page list) may sit inside a
  // unit rather than start one. Snap back to the unit that contains it, so the pairing is
  // a property of the book instead of the reader's navigation history.
  useEffect(() => {
    if (!chain) {
      return;
    }

    if (adoptedPathRef.current !== containerPath) {
      adoptedPathRef.current = containerPath;
      if (!chain.units.has(index)) {
        dispatch(setSpreadShifted(true));
      }
      return;
    }

    if (!chain.units.has(index)) {
      const start = chain.starts.filter((s) => s < index).at(-1);
      if (start !== undefined) {
        dispatch(setImageIndex(start));
      }
    }
  }, [chain, containerPath, index, dispatch]);

  const getDims = useCallback(
    (i: number): PageDims | undefined => dimsRef.current.get(entries[i]),
    [entries],
  );

  // The chain wins when it exists: an anchored unit can differ from what the local rule
  // would decide, and display and navigation must agree on the same one.
  const currentUnit = useCallback(
    (): UnitDecision | null =>
      chain?.units.get(index) ?? resolveUnit(index, entries, getDims, settings),
    [chain, index, entries, getDims, settings],
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

      /** Builds the layout for the current index from its unit, if both are available. */
      const layoutForCurrentIndex = (): ViewLayout | null => {
        const unit = currentUnit();
        return unit ? buildUnitLayout(unit, index, entries, cache) : null;
      };

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
          if (!dimsRef.current.has(path)) {
            dimsRef.current.set(path, { width: newItem.width, height: newItem.height });
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
          const layout = layoutForCurrentIndex();
          if (layout) {
            layoutResolved = true;
            setLayoutState({ layout, path: containerPath });
          }
        }
      };

      const missingFullPaths = pathsToLoad.filter((p) => !cache.get(p)?.fullUrl);
      if (missingFullPaths.length === 0) {
        setIsImageLoading(false);
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
          setIsImageLoading(false);
        }
      }

      // Continue fetching full-res images in the background
      await Promise.all(fullPromises);

      if (!controller.signal.aborted) {
        // Loading has settled. If no full layout resolved (e.g. a spread's second
        // page failed to load), degrade to a single-page layout for the first image
        // instead of leaving the viewer blank/stale.
        if (!layoutResolved) {
          const firstImg = cache.get(entries[index]);
          if (firstImg) {
            setLayoutState({ layout: buildSinglePageLayout(firstImg), path: containerPath });
          }
        }
        if (previewPromises.length === 0) {
          setIsImageLoading(false);
        }
      }
    };

    updateLayout();

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [containerPath, index, entries, settings, currentUnit]);

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

    // Reconstruct the real previous unit start from a forward walk (mirrors
    // moveForward). Falls back to the local heuristic below when the walk can't
    // run (incomplete dimensions / unexpected layout).
    const previousStart = findPreviousUnitStart(index, entries, getDims, settings);
    if (previousStart !== null) {
      goTo(previousStart);
      return;
    }

    // The walk could not run. Pick the candidate whose unit increment lands exactly on
    // the current index; "is the previous page landscape" misses portrait pages that are
    // single because the page after them is landscape. Parity is locally unknowable, so
    // prefer the spread two pages back when both candidates are consistent.
    const unitTwoBack = index >= 2 ? resolveUnit(index - 2, entries, getDims, settings) : null;
    if (unitTwoBack?.nextIndexIncrement === 2) {
      goTo(index - 2);
      return;
    }

    // Either index - 1 is a unit start of its own, or it starts the spread the current
    // index sits inside; both cases re-align to it.
    const unitOneBack = resolveUnit(index - 1, entries, getDims, settings);
    if (unitOneBack) {
      goTo(index - 1);
      return;
    }

    // Dimensions unknown: keep the historical "two pages back" default.
    goTo(Math.max(0, index - 2));
  }, [index, entries, settings, goTo, chain, getDims, onBackwardBoundary]);

  return {
    displayedLayout,
    isImageLoading,
    moveForward,
    moveBack,
  };
};
