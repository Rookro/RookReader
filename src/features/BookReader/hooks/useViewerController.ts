import { warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestPreloadAround } from "../../../bindings/ContainerCommands";
import type { AppDispatch } from "../../../store/store";
import type { Image } from "../../../types/Image";
import { setImageIndex } from "../slice";
import {
  buildSinglePageLayout,
  calculateLayout,
  createImageCacheItem,
  fetchImageBlob,
  fetchImagePreviewBlob,
  type ImageCacheItem,
  type ViewerSettings,
  type ViewLayout,
} from "../utils/ImageUtils";

/**
 * Revokes every object URL held by the cache entries.
 *
 * @param cache - The image cache whose `previewUrl`/`fullUrl` object URLs should be revoked.
 */
const revokeCacheUrls = (cache: Map<string, ImageCacheItem>) => {
  cache.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    if (item.fullUrl) {
      URL.revokeObjectURL(item.fullUrl);
    }
  });
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
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [layoutState, setLayoutState] = useState<{ layout: ViewLayout; path: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
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

      // Tracks whether a full layout was resolved this run, so the post-settle
      // fallback only fires when calculateLayout never produced one.
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
          const layout = calculateLayout(index, entries, cache, settings);
          if (layout) {
            layoutResolved = true;
            setLayoutState({ layout, path: containerPath });
          }
        }
      };

      const missingFullPaths = pathsToLoad.filter((p) => !cache.get(p)?.fullUrl);
      if (missingFullPaths.length === 0) {
        setIsImageLoading(false);
        const layout = calculateLayout(index, entries, cache, settings);
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
  }, [containerPath, index, entries, settings]);

  // Request preloading around the current index in the backend.
  useEffect(() => {
    if (entries.length > 0) {
      requestPreloadAround(index, settings.preloadPageCount).catch((e) => {
        warn(`Failed to request preload: ${String(e)}`);
      });
    }
  }, [index, settings.preloadPageCount, entries.length]);

  const displayedLayout = layoutState?.path === containerPath ? layoutState?.layout : null;

  const moveForward = useCallback(() => {
    if (entries.length === 0) {
      return;
    }

    // Derive the increment from the current index's layout (read from the cache now),
    // not the lagging displayedLayout, which would desync spread pairs / skip pages.
    const currentLayout = calculateLayout(index, entries, cacheRef.current, settings);
    const increment = currentLayout?.nextIndexIncrement ?? (settings.isTwoPagedView ? 2 : 1);
    const nextIndex = index + increment;

    if (nextIndex < entries.length) {
      dispatch(setImageIndex(nextIndex));
    } else {
      // Already at the last page: hand off to the adjacent-book handler.
      onForwardBoundary?.();
    }
  }, [index, entries, dispatch, settings, onForwardBoundary]);

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
      dispatch(setImageIndex(Math.max(0, index - 1)));
      return;
    }

    const indexFor1PagesBack = Math.max(0, index - 1);
    const simulatedLayoutFor1PagesBack = calculateLayout(
      indexFor1PagesBack,
      entries,
      cacheRef.current,
      settings,
    );

    // If the previous page is landscape, go back only one page.
    if (
      simulatedLayoutFor1PagesBack &&
      !simulatedLayoutFor1PagesBack.isSpread &&
      simulatedLayoutFor1PagesBack.firstImage &&
      simulatedLayoutFor1PagesBack.firstImage.width > simulatedLayoutFor1PagesBack.firstImage.height
    ) {
      dispatch(setImageIndex(indexFor1PagesBack));
      return;
    }

    const indexFor2PagesBack = Math.max(0, index - 2);
    const simulatedLayoutFor2PagesBack = calculateLayout(
      indexFor2PagesBack,
      entries,
      cacheRef.current,
      settings,
    );

    // If the layout calculation fails, fall back to going back two pages.
    if (!simulatedLayoutFor2PagesBack) {
      dispatch(setImageIndex(indexFor2PagesBack));
      return;
    }

    // If the page 2 steps back is landscape, go back only one page.
    if (
      !simulatedLayoutFor2PagesBack.isSpread &&
      simulatedLayoutFor2PagesBack.firstImage &&
      simulatedLayoutFor2PagesBack.firstImage.width > simulatedLayoutFor2PagesBack.firstImage.height
    ) {
      dispatch(setImageIndex(indexFor1PagesBack));
      return;
    }

    dispatch(setImageIndex(indexFor2PagesBack));
  }, [index, entries, settings, dispatch, onBackwardBoundary]);

  return {
    displayedLayout,
    isImageLoading,
    moveForward,
    moveBack,
  };
};
