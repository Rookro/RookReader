import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppDispatch } from "../../../store/store";
import { setImageIndex } from "../slice";
import type { UnitChain, ViewerSettings } from "../utils/ImageUtils";
import { assumedChainFrom, chainFrom, containingUnitStart } from "../utils/spreadPairing";

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

/** How the open book pairs its pages, as far as the viewer knows it. */
export interface SpreadPairing {
  /** The book's own chain; null until it has been measured. */
  chain: UnitChain | null;
  /** What display, navigation and the snap use; null only inside the wait cap. */
  pairing: UnitChain | null;
  /** Records a loaded page's shape while the book is unmeasured. Stable across renders. */
  recordLoadedPage: (entry: string, isLandscape: boolean) => void;
}

/** What {@link useSpreadPairing} needs to decide the pairing. */
export interface SpreadPairingOptions {
  /** The path of the container file. */
  containerPath: string;
  /** Entries in the container. */
  entries: string[];
  /** The book's measured page shapes, or null until it has been measured. */
  landscape: boolean[] | null;
  /** Viewer settings. */
  settings: ViewerSettings;
  /** Whether this book's spread pairing is shifted by one. */
  isSpreadShifted: boolean;
  /** Index of the current image. */
  index: number;
  /** Dispatch function from Redux. */
  dispatch: AppDispatch;
}

/**
 * Decides how the open book pairs its pages: from its measurement once it has one, and
 * from the settings and the pages already loaded once the wait cap has passed. Keeps the
 * current index on a unit start.
 *
 * @param options See {@link SpreadPairingOptions}.
 * @returns See {@link SpreadPairing}.
 */
export const useSpreadPairing = ({
  containerPath,
  entries,
  landscape,
  settings,
  isSpreadShifted,
  index,
  dispatch,
}: SpreadPairingOptions): SpreadPairing => {
  // Set once the viewer has waited CHAIN_WAIT_CAP_MS for a chain that has not arrived.
  const [chainWaitElapsed, setChainWaitElapsed] = useState(false);
  // The shape of the pages the viewer has loaded, which is all it knows about a book the
  // measurement has not described yet. Recorded only while that is the case, so a
  // measured book — every book after its first open — never pays for it.
  const [loadedLandscape, setLoadedLandscape] = useState<ReadonlyMap<string, boolean>>(new Map());

  // biome-ignore lint/correctness/useExhaustiveDependencies: forget the loaded shapes whenever containerPath changes.
  useEffect(() => {
    setLoadedLandscape(new Map());
  }, [containerPath]);

  const recordLoadedPage = useCallback((entry: string, isLandscape: boolean) => {
    setLoadedLandscape((known) =>
      known.has(entry) ? known : new Map(known).set(entry, isLandscape),
    );
  }, []);

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

  return { chain, pairing, recordLoadedPage };
};
