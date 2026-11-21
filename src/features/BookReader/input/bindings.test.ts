import { describe, expect, it } from "vitest";
import {
  type Binding,
  findAction,
  findClickAction,
  READER_BINDINGS,
  SIDE_PANE_BINDINGS,
} from "./bindings";
import { type Combo, parseCombo } from "./combo";

const c = (n: string) => parseCombo(n) as Combo;

describe("findAction", () => {
  it("matches a binding exactly", () => expect(findAction(c("ArrowLeft"))).toBe("pageLeft"));

  it("ignores Shift for a key without a Shift binding", () =>
    expect(findAction(c("Shift+ArrowRight"))).toBe("pageRight"));

  it("does not match with Ctrl, Alt or Meta held", () => {
    for (const m of ["Ctrl", "Alt", "Meta"]) {
      expect(findAction(c(`${m}+ArrowLeft`))).toBeNull();
    }
  });

  it("keeps Shift when the key has a Shift binding", () => {
    const table: Binding[] = [
      { combo: "S", action: "nextPage" },
      { combo: "Shift+S", action: "previousPage" },
    ];
    expect(findAction(c("Shift+S"), table)).toBe("previousPage");
    expect(findAction(c("S"), table)).toBe("nextPage");
  });

  it("does not fall back to the unshifted binding with Ctrl held", () => {
    const table: Binding[] = [{ combo: "Ctrl+S", action: "nextPage" }];
    expect(findAction(c("Ctrl+Shift+S"), table)).toBeNull();
  });

  it("tells the built-in Shift bindings apart from their unshifted keys", () => {
    expect(findAction(c("S"))).toBe("toggleSpread");
    expect(findAction(c("Shift+S"))).toBe("shiftSpread");
    expect(findAction(c("Space"))).toBe("nextPage");
    expect(findAction(c("Shift+Space"))).toBe("previousPage");
  });

  it("returns null for an unbound key", () => expect(findAction(c("Enter"))).toBeNull());

  it("finds the side pane's bindings and the reader's F6", () => {
    expect(findAction(c("Ctrl+Tab"), SIDE_PANE_BINDINGS)).toBe("nextSidePanel");
    expect(findAction(c("Ctrl+Shift+Tab"), SIDE_PANE_BINDINGS)).toBe("previousSidePanel");
    expect(findAction(c("Escape"), SIDE_PANE_BINDINGS)).toBe("focusReader");
    expect(findAction(c("F6"), READER_BINDINGS)).toBe("focusSidePane");
  });
});

describe("findClickAction", () => {
  it("turns to the next page on a left-click anywhere in anywhere mode", () => {
    expect(findClickAction("anywhere", "left", 0.2)).toBe("nextPage");
    expect(findClickAction("anywhere", "left", 0.9)).toBe("nextPage");
    expect(findClickAction("anywhere", "left", null)).toBe("nextPage");
  });

  it("goes to the previous page on a right-click in anywhere mode", () =>
    expect(findClickAction("anywhere", "right", 0.2)).toBe("previousPage"));

  it("turns towards the clicked side in bySide mode, the middle line counting as the right", () => {
    expect(findClickAction("bySide", "left", 0)).toBe("pageLeft");
    expect(findClickAction("bySide", "left", 0.49)).toBe("pageLeft");
    expect(findClickAction("bySide", "left", 0.5)).toBe("pageRight");
    expect(findClickAction("bySide", "left", 1)).toBe("pageRight");
  });

  it("does not match a left-click without a position in bySide mode", () =>
    expect(findClickAction("bySide", "left", null)).toBeNull());

  it("goes to the previous page on a right-click in bySide mode", () => {
    expect(findClickAction("bySide", "right", 0.1)).toBe("previousPage");
    expect(findClickAction("bySide", "right", null)).toBe("previousPage");
  });

  it("leaves the left and right buttons out of the reader's combo bindings", () => {
    expect(findAction(c("MouseLeft"))).toBeNull();
    expect(findAction(c("MouseRight"))).toBeNull();
  });
});
