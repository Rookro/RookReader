import { describe, expect, it } from "vitest";
import { comboOf, mouseButtonName, normalizeKey, parseCombo, sameCombo } from "./combo";

const none = { ctrl: false, alt: false, shift: false, meta: false };

describe("normalizeKey", () => {
  it("names the space key, upper-cases one character and keeps named keys", () => {
    expect(normalizeKey(" ")).toBe("Space");
    expect(normalizeKey("l")).toBe("L");
    expect(normalizeKey("ArrowLeft")).toBe("ArrowLeft");
  });
});

describe("parseCombo", () => {
  it("parses a bare key", () => {
    expect(parseCombo("l")).toEqual({ key: "L", ...none });
  });

  it("parses modifiers", () => {
    expect(parseCombo("Ctrl+Shift+L")).toEqual({ ...none, key: "L", ctrl: true, shift: true });
  });

  it("parses the space key", () => {
    expect(parseCombo("Space")?.key).toBe("Space");
  });

  it("parses the plus key", () => {
    expect(parseCombo("Shift++")).toEqual({ ...none, key: "+", shift: true });
  });

  it("parses a mouse button", () => {
    expect(parseCombo("Alt+MouseMiddle")).toEqual({ ...none, key: "MouseMiddle", alt: true });
  });

  it("returns null for an empty string", () => {
    expect(parseCombo("")).toBeNull();
  });
});

describe("mouseButtonName", () => {
  it("names the middle, back and forward buttons only", () => {
    expect(mouseButtonName(1)).toBe("MouseMiddle");
    expect(mouseButtonName(3)).toBe("MouseBack");
    expect(mouseButtonName(4)).toBe("MouseForward");
    expect(mouseButtonName(0)).toBeNull();
    expect(mouseButtonName(2)).toBeNull();
  });
});

describe("comboOf", () => {
  it("names the space key", () => {
    expect(comboOf(new KeyboardEvent("keydown", { key: " " }))?.key).toBe("Space");
  });

  it("reads the key and its modifiers", () => {
    expect(comboOf(new KeyboardEvent("keydown", { key: "s", shiftKey: true }))).toEqual({
      ...none,
      key: "S",
      shift: true,
    });
  });

  it("returns null for a modifier-only key", () => {
    expect(comboOf(new KeyboardEvent("keydown", { key: "Shift" }))).toBeNull();
  });

  it("reads a mouse button", () => {
    expect(comboOf(new MouseEvent("mousedown", { button: 3 }))?.key).toBe("MouseBack");
  });

  it("returns null for the primary mouse button", () => {
    expect(comboOf(new MouseEvent("mousedown", { button: 0 }))).toBeNull();
  });
});

describe("sameCombo", () => {
  it("compares the key and every modifier", () => {
    // biome-ignore lint/style/noNonNullAssertion: both notations parse
    expect(sameCombo(parseCombo("Ctrl+L")!, parseCombo("Ctrl+Shift+L")!)).toBe(false);
    // biome-ignore lint/style/noNonNullAssertion: both notations parse
    expect(sameCombo(parseCombo("Ctrl+L")!, parseCombo("Ctrl+l")!)).toBe(true);
  });
});
