import { useCallback } from "react";
import type { AppDispatch } from "../../../store/store";
import { setImageIndex } from "../slice";
import type { UnitChain } from "../utils/ImageUtils";
import { nextUnitStart, previousUnitStart, walkUnits } from "../utils/spreadPairing";
import type { PageMove, PageMoveOptions } from "./usePageNavigation";

/** What {@link useSpreadNavigation} needs to step through the open book. */
export interface SpreadNavigationOptions {
  /** The pairing being displayed, or null while there is none. */
  pairing: UnitChain | null;
  /** The number of pages in the book. */
  pageCount: number;
  /** Index of the current image. */
  index: number;
  /** Whether the viewer pairs pages at all. */
  isTwoPagedView: boolean;
  /** Dispatch function from Redux. */
  dispatch: AppDispatch;
  /** Called when moving forward past the last page. */
  onForwardBoundary?: () => void;
  /** Called when moving back before the first page. */
  onBackwardBoundary?: () => void;
}

/**
 * Decides which page a step forward or back lands on, by displayed units.
 *
 * {@link usePageNavigation} maps keys, the wheel and clicks to these moves; this hook is
 * what the moves do.
 *
 * @param options See {@link SpreadNavigationOptions}.
 * @returns The moves forward and back.
 */
export const useSpreadNavigation = ({
  pairing,
  pageCount,
  index,
  isTwoPagedView,
  dispatch,
  onForwardBoundary,
  onBackwardBoundary,
}: SpreadNavigationOptions): { moveForward: PageMove; moveBack: PageMove } => {
  const goTo = useCallback(
    (nextIndex: number) => {
      dispatch(setImageIndex(nextIndex));
    },
    [dispatch],
  );

  // The index one displayed unit after `i`, or null past the last page. Derive the
  // increment from the unit at `i`, not the lagging displayedLayout, which would desync
  // spread pairs / skip pages. The unit is the one being displayed, so a step never lands
  // on a page the reader has just seen, and a unit chain covers every index contiguously,
  // so it never skips one either.
  const nextIndexFrom = useCallback(
    (i: number): number | null => nextUnitStart(pairing, i, pageCount),
    [pairing, pageCount],
  );

  // The index one displayed unit before `i`, or null on the first page. The preceding unit
  // is the last boundary before `i` of the pairing the viewer is displaying, so back and
  // forward stay in step; without a pairing every unit is a single page.
  const previousIndexFrom = useCallback(
    (i: number): number | null => previousUnitStart(pairing, i, isTwoPagedView),
    [isTwoPagedView, pairing],
  );

  const walk = useCallback(
    (
      step: (i: number) => number | null,
      boundary: (() => void) | undefined,
      options?: PageMoveOptions,
    ): boolean => {
      if (pageCount === 0) {
        return false;
      }
      const steps = options?.steps ?? 1;
      const { at, moved } = walkUnits(index, steps, step);
      if (moved > 0) {
        goTo(at);
      } else if (options?.crossBook !== false) {
        // Already at the first or last page: hand off to the adjacent-book handler.
        boundary?.();
      }
      return moved === steps;
    },
    [pageCount, index, goTo],
  );

  const moveForward = useCallback(
    (options?: PageMoveOptions) => walk(nextIndexFrom, onForwardBoundary, options),
    [walk, nextIndexFrom, onForwardBoundary],
  );

  const moveBack = useCallback(
    (options?: PageMoveOptions) => walk(previousIndexFrom, onBackwardBoundary, options),
    [walk, previousIndexFrom, onBackwardBoundary],
  );

  return { moveForward, moveBack };
};
