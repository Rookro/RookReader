import { warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../bindings/api";
import { type ImageCacheItem, revokeCacheItemUrls, type ViewLayout } from "../utils/ImageUtils";
import type { DisplaySize } from "./useDisplaySize";

/**
 * Revokes every object URL held by the cache entries.
 *
 * @param cache - The image cache whose `previewUrl`/`fullUrl` object URLs should be revoked.
 */
const revokeCacheUrls = (cache: Map<string, ImageCacheItem>) => {
  cache.forEach(revokeCacheItemUrls);
};

/**
 * Retires a page leaving the cache: holds it if it is on screen, or revokes its object URLs
 * at once.
 */
const retirePage = (
  item: ImageCacheItem,
  onScreen: Set<ImageCacheItem>,
  held: Set<ImageCacheItem>,
): void => {
  if (onScreen.has(item)) {
    held.add(item);
  } else {
    revokeCacheItemUrls(item);
  }
};

/** What {@link usePageCache} needs to keep the cache in step with the reader. */
export interface PageCacheOptions {
  /** The path of the container file. */
  containerPath: string;
  /** Entries in the container. */
  entries: string[];
  /** Index of the current image. */
  index: number;
  /** The number of pages preloaded in each direction. */
  preloadPageCount: number;
  /** How large the reader draws a page, in device pixels. */
  displaySize: DisplaySize;
}

/** The open book's loaded pages, and the viewport they were rendered for. */
export interface PageCache {
  /** The loaded pages by entry name. The same `Map` on every render, edited in place. */
  cache: Map<string, ImageCacheItem>;
  /** The viewport the backend has answered for; null until it has. */
  reportedSize: DisplaySize | null;
  /**
   * Tells the cache which pages are on screen; a page it has let go of is revoked once it
   * is no longer one of them. Stable across renders.
   */
  showLayout: (layout: ViewLayout | null) => void;
}

/**
 * Holds the open book's loaded pages and the object URLs behind them: revoked when the
 * book changes and on unmount, and — once off screen — when the viewport changes or a
 * page leaves the window around the current index.
 *
 * @param options See {@link PageCacheOptions}.
 * @returns See {@link PageCache}.
 */
export const usePageCache = ({
  containerPath,
  entries,
  index,
  preloadPageCount,
  displaySize,
}: PageCacheOptions): PageCache => {
  const cacheRef = useRef<Map<string, ImageCacheItem>>(new Map());
  const onScreenRef = useRef<Set<ImageCacheItem>>(new Set());
  const heldRef = useRef<Set<ImageCacheItem>>(new Set());
  // The viewport the backend has answered for, and the gate on loading anything.
  //
  // Not `displaySize` itself: the report is a round trip, and a page asked for before it
  // lands is rendered for whatever viewport the backend still had.
  const [reportedSize, setReportedSize] = useState<DisplaySize | null>(null);

  const showLayout = useCallback((layout: ViewLayout | null) => {
    const onScreen = onScreenRef.current;
    onScreen.clear();
    // The `<img>` on screen holds the image now.
    if (layout?.firstImage) {
      onScreen.add(layout.firstImage);
      layout.firstImage.decoded = undefined;
    }
    if (layout?.secondImage) {
      onScreen.add(layout.secondImage);
      layout.secondImage.decoded = undefined;
    }

    const held = heldRef.current;
    for (const item of held) {
      if (!onScreen.has(item)) {
        revokeCacheItemUrls(item);
        held.delete(item);
      }
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
  }, [containerPath]);

  // Revoke any remaining object URLs when the component unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    const held = heldRef.current;
    const onScreen = onScreenRef.current;
    return () => {
      revokeCacheUrls(cache);
      cache.clear();
      held.forEach(revokeCacheItemUrls);
      held.clear();
      onScreen.clear();
    };
  }, []);

  // Report the viewport, and release the page loader once the backend has it.
  useEffect(() => {
    if (displaySize.width === 0 || displaySize.height === 0) {
      return;
    }
    let cancelled = false;
    api
      .setDisplaySize(displaySize.width, displaySize.height)
      .then(() => {
        if (cancelled) {
          return;
        }
        // The cached blob URLs are pages rendered for the previous viewport. Nothing
        // reloads them: the backend keys a page by the box it was fitted into, so they
        // would simply never be asked for again.
        for (const item of cacheRef.current.values()) {
          retirePage(item, onScreenRef.current, heldRef.current);
        }
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

  // Evict cached pages outside a window around the current index so long sessions
  // don't retain every visited page's blob URLs (unbounded renderer memory). The
  // window always contains the current spread (index, index + 1) and the backend
  // preload range, so backtrack re-fetches hit the backend LRU cache.
  useEffect(() => {
    const radius = Math.max(preloadPageCount, 5);
    const keep = new Set(entries.slice(Math.max(0, index - radius), index + radius + 1));
    for (const [key, item] of cacheRef.current) {
      if (!keep.has(key)) {
        retirePage(item, onScreenRef.current, heldRef.current);
        cacheRef.current.delete(key);
      }
    }
  }, [index, entries, preloadPageCount]);

  return { cache: cacheRef.current, reportedSize, showLayout };
};
