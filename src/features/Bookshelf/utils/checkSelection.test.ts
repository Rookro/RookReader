import { describe, expect, it } from "vitest";
import {
  applyCheckStates,
  type CheckState,
  initialCheckStates,
  nextCheckState,
} from "./checkSelection";

describe("checkSelection", () => {
  it("marks items on all, some and none of the books", () => {
    const states = initialCheckStates([[1, 2], [1]], [1, 2, 3]);
    expect(states.get(1)).toBe("checked");
    expect(states.get(2)).toBe("mixed");
    expect(states.get(3)).toBe("unchecked");
  });

  it("cycles a mixed item back to mixed", () => {
    expect(nextCheckState("mixed", "mixed")).toBe("checked");
    expect(nextCheckState("checked", "mixed")).toBe("unchecked");
    expect(nextCheckState("unchecked", "mixed")).toBe("mixed");
    expect(nextCheckState("unchecked", "unchecked")).toBe("checked");
    expect(nextCheckState("checked", "unchecked")).toBe("unchecked");
  });

  // Editing several books must not strip the items the user did not touch
  it("adds and removes only the items the user changed", () => {
    const current = new Map([
      [10, [1, 2]],
      [11, [1]],
    ]);
    const states = new Map<number, CheckState>([
      [1, "unchecked"],
      [2, "mixed"],
      [3, "checked"],
    ]);
    expect(applyCheckStates(current, states)).toEqual([
      { bookId: 10, ids: [2, 3] },
      { bookId: 11, ids: [3] },
    ]);
  });

  it("skips books whose items do not change", () => {
    const current = new Map([[10, [1]]]);
    expect(applyCheckStates(current, new Map([[1, "checked"]]))).toEqual([]);
  });
});
