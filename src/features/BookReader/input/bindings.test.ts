import { describe, expect, it } from "vitest";
import { type Binding, findAction } from "./bindings";
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
});
