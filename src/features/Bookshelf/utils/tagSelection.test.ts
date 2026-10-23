import { describe, expect, it } from "vitest";
import { applyTagStates, initialTagStates, nextTagState, type TagCheckState } from "./tagSelection";

describe("tagSelection", () => {
  it("marks tags on all, some and none of the books", () => {
    const states = initialTagStates([[1, 2], [1]], [1, 2, 3]);
    expect(states.get(1)).toBe("checked");
    expect(states.get(2)).toBe("mixed");
    expect(states.get(3)).toBe("unchecked");
  });

  it("cycles a mixed tag back to mixed", () => {
    expect(nextTagState("mixed", "mixed")).toBe("checked");
    expect(nextTagState("checked", "mixed")).toBe("unchecked");
    expect(nextTagState("unchecked", "mixed")).toBe("mixed");
    expect(nextTagState("unchecked", "unchecked")).toBe("checked");
    expect(nextTagState("checked", "unchecked")).toBe("unchecked");
  });

  // Tagging several books must not strip the tags the user did not touch
  it("adds and removes only the tags the user changed", () => {
    const current = new Map([
      [10, [1, 2]],
      [11, [1]],
    ]);
    const states = new Map<number, TagCheckState>([
      [1, "unchecked"],
      [2, "mixed"],
      [3, "checked"],
    ]);
    expect(applyTagStates(current, states)).toEqual([
      { bookId: 10, tagIds: [2, 3] },
      { bookId: 11, tagIds: [3] },
    ]);
  });

  it("skips books whose tags do not change", () => {
    const current = new Map([[10, [1]]]);
    expect(applyTagStates(current, new Map([[1, "checked"]]))).toEqual([]);
  });
});
