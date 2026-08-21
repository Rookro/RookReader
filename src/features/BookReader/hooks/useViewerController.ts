import { warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getImageDimensions, requestPreloadAround } from "../../../bindings/ContainerCommands";
import type { AppDispatch } from "../../../store/store";
import type { Image } from "../../../types/Image";
import { setImageIndex } from "../slice";
import {
  buildSinglePageLayout,
  buildUnitChain,
  buildUnitLayout,
  createImageCacheItem,
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

/**
 * Hooks for controlling the image viewer.
 *
 * @param containerPath The path of the container file.
 * @param entries Entries in the container.
 * @param index Index of the current image.
 * @param settings Viewer settings.
 * @param dispatch Dispatch function from Redux.
 * @param onForwardBoundary Called when moving forward past the last page.
 * @param onBackwardBoundary Called when moving back before the first page.
 * @returns ViewerController.
 */
export const useViewerController = (
  containerPath: string,
  entries: string[],
  index: number,
  settings: ViewerSettings,
  dispatch: AppDispatch,
  onForwardBoundary?: () => void,
  onBackwardBoundary?: () => void,
): ViewerController => {
  const cacheRef = useRef<Map<string, ImageCacheItem>>(new Map());
  // Dimensions are kept apart from the blob cache: they are tiny, and navigation needs
  // them for pages whose blobs have already been evicted.
  const dimsRef = useRef<Map<string, PageDims>>(new Map());
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [layoutState, setLayoutState] = useState<{ layout: ViewLayout; path: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [scannedDims, setScannedDims] = useState<{ path: string; dims: PageDims[] } | null>(null);
  // The index the unit chain is laid out from. A page jumped to becomes a unit start,
  // so the chain has to be rebuilt from wherever the reader landed.
  const [anchor, setAnchor] = useState(index);
  // The index this hook is about to dispatch, so an index change it did not cause
  // (slider, bookmark, restored position) is recognisable as an external jump.
  const expectedIndexRef = useRef<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
    dimsRef.current.clear();
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

  // Re-anchor the chain at the current page whenever it has to be rebuilt: an external
  // jump, or a change to one of the chain's inputs. Navigation this hook dispatched
  // follows the existing chain and must not move the anchor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the extra dependencies are rebuild triggers; the anchor is always the current index.
  useEffect(() => {
    if (expectedIndexRef.current !== index) {
      setAnchor(index);
    }
    expectedIndexRef.current = null;
  }, [index, scannedDims, entries, settings]);

  const chain = useMemo(() => {
    if (!scannedDims || scannedDims.path !== containerPath) {
      return null;
    }
    // A short or stale scan cannot describe this book; keep the fallback instead.
    if (scannedDims.dims.length !== entries.length) {
      return null;
    }
    return buildUnitChain(anchor, entries, (i) => scannedDims.dims[i], settings);
  }, [scannedDims, containerPath, anchor, entries, settings]);

  const getDims = useCallback(
    (i: number): PageDims | undefined => dimsRef.current.get(entries[i]),
    [entries],
  );

  // The chain wins when it exists: a unit it derived while walking backward can differ
  // from what the local forward rule would decide, and display and navigation must agree.
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
        fetcher: (containerPath: string, entryName: string) => Promise<Image | undefined>,
        isPreview: boolean,
      ) => {
        if (controller.signal.aborted) return;
        const img = await fetcher(containerPath, path);
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

      const missingPreviewPaths = settings.enablePreview
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
      requestPreloadAround(index, settings.preloadPageCount).catch((e) => {
        warn(`Failed to request preload: ${String(e)}`);
      });
    }
  }, [index, settings.preloadPageCount, entries.length]);

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

  /** Records the index about to be dispatched, then dispatches it. */
  const goTo = useCallback(
    (nextIndex: number) => {
      expectedIndexRef.current = nextIndex;
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
