import { warn } from "@tauri-apps/plugin-log";
import { useEffect, useRef, useState } from "react";
import { setDisplaySize } from "../../../bindings/ContainerCommands";
import { type ImageCacheItem, revokeCacheItemUrls } from "../utils/ImageUtils";
import type { DisplaySize } from "./useDisplaySize";

/**
 * Revokes every object URL held by the cache entries.
 *
 * @param cache - The image cache whose `previewUrl`/`fullUrl` object URLs should be revoked.
 */
const revokeCacheUrls = (cache: Map<string, ImageCacheItem>) => {
  cache.forEach(revokeCacheItemUrls);
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
}

/**
 * Holds the open book's loaded pages and the object URLs behind them: revoked when the
 * book changes, when the viewport changes, when a page leaves the window around the
 * current index, and on unmount.
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
  // The viewport the backend has answered for, and the gate on loading anything.
  //
  // Not `displaySize` itself: the report is a round trip, and a page asked for before it
  // lands is rendered for whatever viewport the backend still had.
  const [reportedSize, setReportedSize] = useState<DisplaySize | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: update the cache whenever containerPath changes.
  useEffect(() => {
    revokeCacheUrls(cacheRef.current);
    cacheRef.current.clear();
  }, [containerPath]);

  // Revoke any remaining object URLs when the component unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      revokeCacheUrls(cache);
      cache.clear();
    };
  }, []);

  // Report the viewport, and release the page loader once the backend has it.
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

  // Evict cached pages outside a window around the current index so long sessions
  // don't retain every visited page's blob URLs (unbounded renderer memory). The
  // window always contains the current spread (index, index + 1) and the backend
  // preload range, so backtrack re-fetches hit the backend LRU cache.
  useEffect(() => {
    const radius = Math.max(preloadPageCount, 5);
    const keep = new Set(entries.slice(Math.max(0, index - radius), index + radius + 1));
    for (const [key, item] of cacheRef.current) {
      if (!keep.has(key)) {
        revokeCacheItemUrls(item);
        cacheRef.current.delete(key);
      }
    }
  }, [index, entries, preloadPageCount]);

  return { cache: cacheRef.current, reportedSize };
};
