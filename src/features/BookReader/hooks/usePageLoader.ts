import { warn } from "@tauri-apps/plugin-log";
import { useEffect, useRef, useState } from "react";
import { requestPreloadAround } from "../../../bindings/ContainerCommands";
import type { ErrorCode } from "../../../types/Error";
import { perf, perfSince, perfStart } from "../../../utils/perf";
import {
  buildSinglePageLayout,
  buildUnitLayout,
  type ImageCacheItem,
  SINGLE_UNIT,
  type UnitChain,
  type ViewerSettings,
  type ViewLayout,
} from "../utils/ImageUtils";
import { loadPageIntoCache, pagesToLoad } from "../utils/pageLoading";
import type { DisplaySize } from "./useDisplaySize";

/** What {@link usePageLoader} needs to load and lay out the current pages. */
export interface PageLoaderOptions {
  /** The path of the container file. */
  containerPath: string;
  /** Entries in the container. */
  entries: string[];
  /** Index of the current image. */
  index: number;
  /** Viewer settings. */
  settings: ViewerSettings;
  /** Whether the open book can send a page's preview more cheaply than the page. */
  hasPreviews: boolean;
  /** The page cache from {@link usePageCache}. */
  cache: Map<string, ImageCacheItem>;
  /** The viewport the backend has answered for; nothing loads until it has. */
  reportedSize: DisplaySize | null;
  /** The book's own chain; null until it has been measured. */
  chain: UnitChain | null;
  /** The pairing to display; null while the viewer is still waiting for one. */
  pairing: UnitChain | null;
  /** Records a loaded page's shape while the book is unmeasured. Must be stable. */
  recordLoadedPage: (entry: string, isLandscape: boolean) => void;
}

/** The layout the viewer shows, and whether it is still loading one. */
export interface PageLoader {
  /** Layout to display. */
  displayedLayout: ViewLayout | null;
  /** Is loading a image. */
  isImageLoading: boolean;
}

/**
 * Loads the current page (and, in spread view, the next) into the cache, publishes the
 * layout once the pairing allows it, and asks the backend to preload around it.
 *
 * @param options See {@link PageLoaderOptions}.
 * @returns See {@link PageLoader}.
 */
export const usePageLoader = ({
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
}: PageLoaderOptions): PageLoader => {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [layoutState, setLayoutState] = useState<{ layout: ViewLayout; path: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

      const pathsToLoad = pagesToLoad(entries, index, settings.isTwoPagedView);

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
       *
       * The unit is the one the viewer is showing, which is also the unit navigation
       * steps by. A single page is the answer for an index that is not a unit start —
       * the snap is what normally settles that.
       */
      const layoutForCurrentIndex = (): ViewLayout | null =>
        pairing
          ? buildUnitLayout(
              pairing.units.get(index) ?? SINGLE_UNIT,
              index,
              entries,
              cache,
              failures,
            )
          : null;

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

      const loadAndUpdate = async (path: string, isPreview: boolean) => {
        const result = await loadPageIntoCache(
          cache,
          containerPath,
          path,
          isPreview,
          controller.signal,
        );
        if (result.status === "failed") {
          // A preview is answered by the full image that follows it, so only the page
          // itself failing is worth putting on screen.
          if (!isPreview) {
            failures.set(path, result.code);
            publishLayout();
          }
        } else if (result.status === "loaded") {
          // A full page's own dimensions are the one thing the viewer can know about an
          // unmeasured book. A preview is not that page: its format chose its size.
          if (!isPreview && !chain) {
            recordLoadedPage(path, result.isLandscape);
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

      const previewPromises = missingPreviewPaths.map((path) => loadAndUpdate(path, true));
      const fullPromises = missingFullPaths.map((path) => loadAndUpdate(path, false));

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
    pairing,
    chain,
    reportedSize,
    recordLoadedPage,
    cache,
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

  const displayedLayout = layoutState?.path === containerPath ? layoutState?.layout : null;

  return { displayedLayout, isImageLoading };
};
