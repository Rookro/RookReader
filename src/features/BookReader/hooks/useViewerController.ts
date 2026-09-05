import { error, warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updatePageLayout } from "../../../bindings/BookCommands";
import type { BookWithState } from "../../../bindings/bindings";
import { getImageDimensions, requestPreloadAround } from "../../../bindings/ContainerCommands";
import type { AppDispatch } from "../../../store/store";
import { createCommandError, type ErrorCode } from "../../../types/Error";
import type { Image } from "../../../types/Image";
import { perf, perfSince, perfStart } from "../../../utils/perf";
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
 * Builds a book's unit chain from its measured pages and the reader's correction.
 *
 * The archive's own landscape pages prove whether it carries the cover, so they outrank
 * `isFirstPageSingleView`, which is only a default for archives that offer no proof. The
 * reader's toggle outranks both, so the button always changes the chain — including when
 * a landscape page would otherwise decide it.
 *
 * @param landscape Whether each page is wider than it is tall, in entry order.
 * @param settings The viewer settings.
 * @param isSpreadShifted The reader's persisted correction for this book.
 * @returns The chain covering every page.
 */
const chainFrom = (landscape: boolean[], settings: ViewerSettings, isSpreadShifted: boolean) => {
  const base = detectCoverPresence(landscape) ?? settings.isFirstPageSingleView;
  return buildUnitChain(landscape, settings, isSpreadShifted ? !base : base);
};

/**
 * Builds the chain to use while the book has not been measured, from whatever pages the
 * viewer has already loaded.
 *
 * Two tiers of evidence, taken separately because only one of them survives partial
 * knowledge:
 *
 * - **Whether a page pairs** is read from the pages actually loaded. A landscape image is
 *   one physical spread, so it never shares a screen — a fact about that page alone, true
 *   no matter what the rest of the book turns out to be.
 * - **Where spreads begin** comes from `isFirstPageSingleView` only, never from
 *   [`detectCoverPresence`]. Detection counts the pages before a landscape image to fix
 *   the parity, so a single unloaded landscape page earlier in the book flips its answer;
 *   on partial knowledge it is not evidence, it is a coin flip.
 *
 * Unloaded pages are taken for portrait, which is what the whole fallback assumes, and the
 * chain sharpens as the reader reads. A displayed unit is always decided with its own
 * pages known, because a layout is only published once its images are cached.
 *
 * @param entries The list of entry names.
 * @param landscapeByEntry What the viewer has measured so far, by entry name.
 * @param settings The viewer settings.
 * @param isSpreadShifted The reader's persisted correction for this book.
 * @returns The chain covering every page.
 */
const assumedChainFrom = (
  entries: string[],
  landscapeByEntry: ReadonlyMap<string, boolean>,
  settings: ViewerSettings,
  isSpreadShifted: boolean,
) => {
  const landscape = entries.map((entry) => landscapeByEntry.get(entry) ?? false);
  const base = settings.isFirstPageSingleView;
  return buildUnitChain(landscape, settings, isSpreadShifted ? !base : base);
};

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
  // The shape of the pages the viewer has loaded, which is all it knows about a book the
  // measurement has not described yet. Recorded only while that is the case, so a
  // measured book — every book after its first open — never pays for it.
  const [loadedLandscape, setLoadedLandscape] = useState<ReadonlyMap<string, boolean>>(new Map());
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
      if (cachedLandscape) {
        // The measurement arrived with the book, so there is no scan to wait for. This
        // is the line that says a reopen cost nothing.
        perf("chain", `source=cached pages=${cachedLandscape.length}`, 0);
      }
      return;
    }

    let cancelled = false;
    const started = perfStart();
    getImageDimensions(containerPath)
      .then((dims) => {
        if (!cancelled) {
          perf("chain", `source=scanned pages=${dims.length}`, perfSince(started) ?? 0);
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
    if (!pairing) {
      return;
    }
    if (!pairing.units.has(index)) {
      const start = pairing.starts.filter((s) => s < index).at(-1);
      if (start !== undefined) {
        dispatch(setImageIndex(start));
      }
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
        // Null is the backend declining, not a failure: only that answer is evidence
        // about the container.
        if (isPreview && img === null && !controller.signal.aborted) {
          previewUnsupportedRef.current = true;
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
  }, [containerPath, index, entries, settings, currentUnit, pairing, chain]);

  // Request preloading around the current index in the backend.
  useEffect(() => {
    if (entries.length > 0) {
      // The same pages the layout effect above loads, named so the backend leaves them
      // to the foreground requests already on their way.
      const callerPages = settings.isTwoPagedView && index + 1 < entries.length ? 2 : 1;
      requestPreloadAround(containerPath, index, settings.preloadPageCount, callerPages).catch(
        (e) => {
          warn(`Failed to request preload: ${String(e)}`);
        },
      );
    }
  }, [containerPath, index, settings.preloadPageCount, settings.isTwoPagedView, entries.length]);

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
    // displayedLayout, which would desync spread pairs / skip pages. The unit is the one
    // being displayed, so a step never lands on a page the reader has just seen, and a
    // unit chain covers every index contiguously, so it never skips one either.
    const increment = currentUnit().nextIndexIncrement;
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

    // The preceding unit is simply the last boundary before the current index — of the
    // same pairing the viewer is displaying, so back and forward stay in step.
    if (pairing) {
      const previous = pairing.starts.filter((start) => start < index).at(-1);
      if (previous !== undefined) {
        goTo(previous);
        return;
      }
    }

    // Without a pairing every unit is a single page, so one step back is the answer.
    goTo(index - 1);
  }, [index, entries.length, settings, goTo, pairing, onBackwardBoundary]);

  return {
    displayedLayout,
    isImageLoading,
    moveForward,
    moveBack,
  };
};
