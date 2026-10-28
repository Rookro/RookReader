import { describe, expect, it } from "vitest";
import type { ViewerSettings } from "./ImageUtils";
import {
  assumedChainFrom,
  chainFrom,
  containingUnitStart,
  nextUnitStart,
  previousUnitStart,
  walkUnits,
} from "./spreadPairing";

const twoPaged: ViewerSettings = {
  isTwoPagedView: true,
  isFirstPageSingleView: false,
  direction: "rtl",
  enablePreview: false,
  preloadPageCount: 10,
};

describe("chainFrom", () => {
  it("lets a landscape page prove the cover over the setting", () => {
    // The setting alone (no cover) would give [0, 1, 2, 3].
    expect(chainFrom([false, true, false, false], twoPaged, false).starts).toEqual([0, 1, 2]);
  });

  it("flips the cover when the book is shifted", () => {
    const cover = { ...twoPaged, isFirstPageSingleView: true };
    expect(chainFrom([false, false, false, false], cover, false).starts).toEqual([0, 1, 3]);
    expect(chainFrom([false, false, false, false], cover, true).starts).toEqual([0, 2]);
  });
});

describe("assumedChainFrom", () => {
  it("assumes unloaded pages are portrait and ignores cover detection", () => {
    expect(assumedChainFrom(["a", "b", "c"], new Map(), twoPaged, false).starts).toEqual([0, 2]);
    // Cover detection would give [0, 1, 2].
    expect(
      assumedChainFrom(["a", "b", "c", "d"], new Map([["b", true]]), twoPaged, false).starts,
    ).toEqual([0, 1, 2, 3]);
  });
});

describe("unit stepping", () => {
  // Starts [0, 1, 3]; unit 1 is a spread.
  const chain = chainFrom(
    [false, false, false, false],
    { ...twoPaged, isFirstPageSingleView: true },
    false,
  );

  it("snaps an index inside a unit to that unit's start", () => {
    expect(containingUnitStart(chain, 2)).toBe(1);
    expect(containingUnitStart(chain, 3)).toBeNull();
    expect(containingUnitStart(chain, 0)).toBeNull();
  });

  it("steps forward by the unit's own increment", () => {
    expect(nextUnitStart(chain, 1, 4)).toBe(3);
    expect(nextUnitStart(chain, 3, 4)).toBeNull();
    expect(nextUnitStart(null, 0, 4)).toBe(1);
  });

  it("steps back to the previous unit start", () => {
    expect(previousUnitStart(chain, 3, true)).toBe(1);
    expect(previousUnitStart(chain, 3, false)).toBe(2);
    expect(previousUnitStart(null, 3, true)).toBe(2);
    expect(previousUnitStart(chain, 0, true)).toBeNull();
  });

  it("walks as many steps as it can", () => {
    expect(walkUnits(0, 3, (i) => (i < 2 ? i + 1 : null))).toEqual({ at: 2, moved: 2 });
    expect(walkUnits(0, 1, () => null)).toEqual({ at: 0, moved: 0 });
  });
});
