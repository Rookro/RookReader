import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppDispatch } from "../../../store/store";
import { setImageIndex } from "../slice";
import type { UnitChain } from "../utils/ImageUtils";
import { type SpreadNavigationOptions, useSpreadNavigation } from "./useSpreadNavigation";

// Page 0 alone, then the spreads 1-2 and 3-4.
const pairing: UnitChain = {
  starts: [0, 1, 3],
  units: new Map([
    [0, { isSpread: false, nextIndexIncrement: 1 }],
    [1, { isSpread: true, nextIndexIncrement: 2 }],
    [3, { isSpread: true, nextIndexIncrement: 2 }],
  ]),
};

const setup = (options: Partial<SpreadNavigationOptions> = {}) => {
  const dispatch = vi.fn() as unknown as AppDispatch;
  const onForwardBoundary = vi.fn();
  const onBackwardBoundary = vi.fn();
  const { result } = renderHook(() =>
    useSpreadNavigation({
      pairing,
      pageCount: 5,
      index: 2,
      isTwoPagedView: true,
      dispatch,
      onForwardBoundary,
      onBackwardBoundary,
      ...options,
    }),
  );
  return { result, dispatch, onForwardBoundary, onBackwardBoundary };
};

describe("useSpreadNavigation: first and last page", () => {
  it("lands on the start of the final spread so both its pages show", () => {
    const { result, dispatch } = setup();
    result.current.moveToLast();
    expect(dispatch).toHaveBeenCalledWith(setImageIndex(3));
  });

  it("lands on the last page when it stands alone after the spreads", () => {
    // The spreads 0-1 and 2-3, then page 4 alone.
    const { result, dispatch } = setup({
      pairing: {
        starts: [0, 2, 4],
        units: new Map([
          [0, { isSpread: true, nextIndexIncrement: 2 }],
          [2, { isSpread: true, nextIndexIncrement: 2 }],
          [4, { isSpread: false, nextIndexIncrement: 1 }],
        ]),
      },
    });
    result.current.moveToLast();
    expect(dispatch).toHaveBeenCalledWith(setImageIndex(4));
  });

  it("lands on the last page in single-page view", () => {
    const { result, dispatch } = setup({ isTwoPagedView: false, pairing: null });
    result.current.moveToLast();
    expect(dispatch).toHaveBeenCalledWith(setImageIndex(4));
  });

  it("lands on the first page", () => {
    const { result, dispatch } = setup();
    result.current.moveToFirst();
    expect(dispatch).toHaveBeenCalledWith(setImageIndex(0));
  });

  it("never hands off to the adjacent book, even at the ends", () => {
    const atLast = setup({ index: 3 });
    atLast.result.current.moveToLast();
    const atFirst = setup({ index: 0 });
    atFirst.result.current.moveToFirst();

    for (const { onForwardBoundary, onBackwardBoundary } of [atLast, atFirst]) {
      expect(onForwardBoundary).not.toHaveBeenCalled();
      expect(onBackwardBoundary).not.toHaveBeenCalled();
    }
  });

  it("does nothing in an empty book", () => {
    const { result, dispatch } = setup({ pageCount: 0, pairing: null });
    result.current.moveToFirst();
    result.current.moveToLast();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
