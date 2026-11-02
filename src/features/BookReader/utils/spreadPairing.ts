import {
  buildUnitChain,
  detectCoverPresence,
  SINGLE_UNIT,
  type UnitChain,
  type ViewerSettings,
} from "./ImageUtils";

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
export const chainFrom = (
  landscape: boolean[],
  settings: ViewerSettings,
  isSpreadShifted: boolean,
): UnitChain => {
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
export const assumedChainFrom = (
  entries: string[],
  landscapeByEntry: ReadonlyMap<string, boolean>,
  settings: ViewerSettings,
  isSpreadShifted: boolean,
): UnitChain => {
  const landscape = entries.map((entry) => landscapeByEntry.get(entry) ?? false);
  const base = settings.isFirstPageSingleView;
  return buildUnitChain(landscape, settings, isSpreadShifted ? !base : base);
};

/**
 * Finds the start of the unit that contains `index`, when `index` sits inside a unit
 * rather than starting one.
 *
 * @param pairing The pairing being displayed.
 * @param index The page index.
 * @returns The start to snap to, or null when `index` starts a unit or none precedes it.
 */
export const containingUnitStart = (pairing: UnitChain, index: number): number | null => {
  if (pairing.units.has(index)) {
    return null;
  }
  return pairing.starts.filter((s) => s < index).at(-1) ?? null;
};

/**
 * The index one displayed unit after `i`.
 *
 * @param pairing The pairing being displayed, or null when every unit is a single page.
 * @param i The index to step from.
 * @param pageCount The number of pages in the book.
 * @returns The next unit's start, or null past the last page.
 */
export const nextUnitStart = (
  pairing: UnitChain | null,
  i: number,
  pageCount: number,
): number | null => {
  const next = i + (pairing?.units.get(i) ?? SINGLE_UNIT).nextIndexIncrement;
  return next < pageCount ? next : null;
};

/**
 * The index one displayed unit before `i`: the last unit start before it.
 *
 * @param pairing The pairing being displayed, or null when every unit is a single page.
 * @param i The index to step from.
 * @param isTwoPagedView Whether the viewer pairs pages at all.
 * @returns The previous unit's start, or null on the first page.
 */
export const previousUnitStart = (
  pairing: UnitChain | null,
  i: number,
  isTwoPagedView: boolean,
): number | null => {
  if (i === 0) {
    return null;
  }
  if (!isTwoPagedView) {
    return i - 1;
  }
  return pairing?.starts.filter((start) => start < i).at(-1) ?? i - 1;
};

/**
 * Takes up to `steps` steps from `from`, stopping where `step` has nowhere to go.
 *
 * @param from The index to start from.
 * @param steps How many steps to take.
 * @param step The index one step after its argument, or null at the end.
 * @returns Where the walk ended and how many steps it took.
 */
export const walkUnits = (
  from: number,
  steps: number,
  step: (i: number) => number | null,
): { at: number; moved: number } => {
  let at = from;
  let moved = 0;
  while (moved < steps) {
    const next = step(at);
    if (next === null) {
      break;
    }
    at = next;
    moved++;
  }
  return { at, moved };
};
