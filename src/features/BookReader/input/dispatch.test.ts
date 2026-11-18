import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageMove } from "../hooks/usePageNavigation";
import type { CommonAction } from "./bindings";
import { parseCombo } from "./combo";
import { type DispatchContext, dispatchReaderInput } from "./dispatch";
import type { PointerPosition } from "./types";

const key = (k: string, init: KeyboardEventInit = {}) =>
  ({
    kind: "key",
    event: new KeyboardEvent("keydown", { key: k, cancelable: true, ...init }),
  }) as const;

const button = (b: number, inReadingArea = true, init: MouseEventInit = {}) =>
  ({
    kind: "button",
    event: new MouseEvent("mousedown", { button: b, cancelable: true, ...init }),
    inReadingArea,
  }) as const;

const commonActions = (): Record<CommonAction, () => void> => ({
  toggleSpread: vi.fn(),
  shiftSpread: vi.fn(),
  toggleDirection: vi.fn(),
  toggleBookmark: vi.fn(),
  toggleSidePane: vi.fn(),
});

const ctx: DispatchContext = {
  isReaderActive: true,
  direction: "ltr",
  loupeToggle: null,
  reader: null,
  common: commonActions(),
};

const reader = () => ({
  nextPage: vi.fn<PageMove>(() => true),
  previousPage: vi.fn<PageMove>(() => true),
  toggleLoupe: vi.fn<(at?: PointerPosition) => void>(),
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("dispatchReaderInput: page keys and clicks", () => {
  it("turns pages left/right by direction", () => {
    const ltr = reader();
    dispatchReaderInput(key("ArrowLeft"), { ...ctx, reader: ltr });
    expect(ltr.previousPage).toHaveBeenCalledTimes(1);
    dispatchReaderInput(key("ArrowRight"), { ...ctx, reader: ltr });
    expect(ltr.nextPage).toHaveBeenCalledTimes(1);

    const rtl = reader();
    dispatchReaderInput(key("ArrowLeft"), { ...ctx, direction: "rtl", reader: rtl });
    expect(rtl.nextPage).toHaveBeenCalledTimes(1);
    dispatchReaderInput(key("ArrowRight"), { ...ctx, direction: "rtl", reader: rtl });
    expect(rtl.previousPage).toHaveBeenCalledTimes(1);
  });

  it("calls a key's move with no argument", () => {
    const r = reader();
    dispatchReaderInput(key("ArrowRight"), { ...ctx, reader: r });
    expect(r.nextPage).toHaveBeenCalledWith();
  });

  it("prevents the default of a handled key", () => {
    const input = key("ArrowRight");
    expect(dispatchReaderInput(input, { ...ctx, reader: reader() })).toBe(true);
    expect(input.event.defaultPrevented).toBe(true);
  });

  it("repeats a held page key", () => {
    const r = reader();
    dispatchReaderInput(key("ArrowRight", { repeat: true }), { ...ctx, reader: r });
    expect(r.nextPage).toHaveBeenCalledTimes(1);
  });

  it("ignores Ctrl+ArrowLeft", () => {
    const r = reader();
    expect(dispatchReaderInput(key("ArrowLeft", { ctrlKey: true }), { ...ctx, reader: r })).toBe(
      false,
    );
    expect(r.previousPage).not.toHaveBeenCalled();
  });

  it("does nothing for other keys", () => {
    const r = reader();
    expect(dispatchReaderInput(key("Enter"), { ...ctx, reader: r })).toBe(false);
    expect(r.nextPage).not.toHaveBeenCalled();
    expect(r.previousPage).not.toHaveBeenCalled();
  });

  it("turns forward on a left click and back on a right click, with no argument", () => {
    const r = reader();
    expect(dispatchReaderInput({ kind: "click", button: "left" }, { ...ctx, reader: r })).toBe(
      true,
    );
    expect(r.nextPage).toHaveBeenCalledWith();
    dispatchReaderInput({ kind: "click", button: "right" }, { ...ctx, reader: r });
    expect(r.previousPage).toHaveBeenCalledWith();
  });

  it("ignores input while the reader view is not active", () => {
    const r = reader();
    expect(
      dispatchReaderInput(key("ArrowLeft"), { ...ctx, isReaderActive: false, reader: r }),
    ).toBe(false);
    expect(r.previousPage).not.toHaveBeenCalled();
  });

  it("ignores input that a component already handled", () => {
    const r = reader();
    const input = key("ArrowLeft");
    input.event.preventDefault();
    expect(dispatchReaderInput(input, { ...ctx, reader: r })).toBe(false);
    expect(r.previousPage).not.toHaveBeenCalled();
  });

  it("ignores input while a menu is open", () => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);
    const r = reader();
    expect(dispatchReaderInput(key("ArrowLeft"), { ...ctx, reader: r })).toBe(false);
    expect(r.previousPage).not.toHaveBeenCalled();
  });
});

describe("dispatchReaderInput: page and common keys", () => {
  it.each([
    { name: "Space", k: " ", init: {}, move: "nextPage" },
    { name: "PageDown", k: "PageDown", init: {}, move: "nextPage" },
    { name: "ArrowDown", k: "ArrowDown", init: {}, move: "nextPage" },
    { name: "Shift+ArrowDown", k: "ArrowDown", init: { shiftKey: true }, move: "nextPage" },
    { name: "Shift+Space", k: " ", init: { shiftKey: true }, move: "previousPage" },
    { name: "PageUp", k: "PageUp", init: {}, move: "previousPage" },
    { name: "ArrowUp", k: "ArrowUp", init: {}, move: "previousPage" },
  ] as const)("$name → $move", ({ k, init, move }) => {
    const r = reader();
    expect(dispatchReaderInput(key(k, init), { ...ctx, reader: r })).toBe(true);
    expect(r[move]).toHaveBeenCalledWith();
    expect(r[move === "nextPage" ? "previousPage" : "nextPage"]).not.toHaveBeenCalled();
  });

  it.each([
    { name: "S", k: "s", init: {}, action: "toggleSpread" },
    { name: "Shift+S", k: "S", init: { shiftKey: true }, action: "shiftSpread" },
    { name: "D", k: "d", init: {}, action: "toggleDirection" },
    { name: "B", k: "b", init: {}, action: "toggleBookmark" },
    { name: "P", k: "p", init: {}, action: "toggleSidePane" },
  ] as const)("$name → $action", ({ k, init, action }) => {
    const common = commonActions();
    const input = key(k, init);
    expect(dispatchReaderInput(input, { ...ctx, reader: reader(), common })).toBe(true);
    expect(common[action]).toHaveBeenCalledTimes(1);
    expect(input.event.defaultPrevented).toBe(true);
    for (const [name, fn] of Object.entries(common)) {
      if (name !== action) {
        expect(fn).not.toHaveBeenCalled();
      }
    }
  });

  it("runs a common action while no reader is registered", () => {
    const common = commonActions();
    expect(dispatchReaderInput(key("p"), { ...ctx, common })).toBe(true);
    expect(common.toggleSidePane).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a held toggle key, but still claims it", () => {
    const common = commonActions();
    const input = key("s", { repeat: true });
    expect(dispatchReaderInput(input, { ...ctx, reader: reader(), common })).toBe(true);
    expect(common.toggleSpread).not.toHaveBeenCalled();
    expect(input.event.defaultPrevented).toBe(true);
  });

  it("repeats a held Space", () => {
    const r = reader();
    dispatchReaderInput(key(" ", { repeat: true }), { ...ctx, reader: r });
    expect(r.nextPage).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchReaderInput: wheel", () => {
  it("passes the gesture's steps on to the move and returns its result", () => {
    const r = reader();
    r.previousPage.mockReturnValue(false);
    const wheel = { kind: "wheel", steps: 2, crossBook: false } as const;
    expect(dispatchReaderInput({ ...wheel, direction: 1 }, { ...ctx, reader: r })).toBe(true);
    expect(r.nextPage).toHaveBeenCalledWith({ steps: 2, crossBook: false });
    expect(dispatchReaderInput({ ...wheel, direction: -1 }, { ...ctx, reader: r })).toBe(false);
    expect(r.previousPage).toHaveBeenCalledWith({ steps: 2, crossBook: false });
  });

  it("returns false for the wheel while no reader is registered", () => {
    expect(
      dispatchReaderInput({ kind: "wheel", direction: 1, steps: 1, crossBook: true }, ctx),
    ).toBe(false);
  });
});

describe("dispatchReaderInput: loupe", () => {
  const withLoupe = (notation: string, r = reader()): DispatchContext => ({
    ...ctx,
    loupeToggle: parseCombo(notation),
    reader: r,
  });

  it("should toggle loupe on valid keyboard shortcut", () => {
    const r = reader();
    dispatchReaderInput(key("l"), withLoupe("l", r));
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
  });

  it("should handle complex keyboard shortcut", () => {
    const r = reader();
    dispatchReaderInput(key("l", { ctrlKey: true, shiftKey: true }), withLoupe("Ctrl+Shift+L", r));
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);

    // Missing Shift: no toggle.
    dispatchReaderInput(key("l", { ctrlKey: true }), withLoupe("Ctrl+Shift+L", r));
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
  });

  it("should handle Space key shortcut", () => {
    const r = reader();
    dispatchReaderInput(key(" "), withLoupe("Space", r));
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
  });

  it("ignores the shortcut while the bookshelf view is active", () => {
    const r = reader();
    dispatchReaderInput(key("l"), { ...withLoupe("l", r), isReaderActive: false });
    expect(r.toggleLoupe).not.toHaveBeenCalled();
  });

  it("should NOT close loupe with Escape key", () => {
    const r = reader();
    dispatchReaderInput(key("l"), withLoupe("l", r));
    dispatchReaderInput(key("Escape"), withLoupe("l", r));
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
  });

  it("toggles on its key only, without turning the page", () => {
    const r = reader();
    dispatchReaderInput(key("ArrowRight"), withLoupe("ArrowRight", r));
    expect(r.toggleLoupe).toHaveBeenCalledWith();
    expect(r.nextPage).not.toHaveBeenCalled();
  });

  it("should handle mouse down shortcut to toggle and call preventDefault", () => {
    const r = reader();
    const input = button(1, true, { ctrlKey: true, clientX: 50, clientY: 50 });
    expect(dispatchReaderInput(input, withLoupe("Ctrl+MouseMiddle", r))).toBe(true);
    expect(r.toggleLoupe).toHaveBeenCalledWith({ clientX: 50, clientY: 50 });
    expect(input.event.defaultPrevented).toBe(true);
  });

  it("should do nothing on mouse down if toggleKey is missing", () => {
    const r = reader();
    dispatchReaderInput(button(1), { ...ctx, reader: r });
    expect(r.toggleLoupe).not.toHaveBeenCalled();
  });

  it("lets a loupe key fall through when no loupe is registered", () => {
    const nextPage = vi.fn(() => true);
    const previousPage = vi.fn(() => true);
    dispatchReaderInput(key("ArrowRight"), {
      ...ctx,
      loupeToggle: parseCombo("ArrowRight"),
      reader: { nextPage, previousPage },
    });
    expect(nextPage).toHaveBeenCalled();
  });

  it("lets a loupe button fall through outside the reading area", () => {
    const r = reader();
    expect(dispatchReaderInput(button(1, false), withLoupe("MouseMiddle", r))).toBe(false);
    expect(r.toggleLoupe).not.toHaveBeenCalled();
  });

  // Mouse buttons act over text fields; only keys are typed into them.
  it("toggles with a button pressed over a text field", () => {
    const r = reader();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.addEventListener("mousedown", (event) =>
      dispatchReaderInput(
        { kind: "button", event, inReadingArea: true },
        withLoupe("MouseMiddle", r),
      ),
    );
    input.dispatchEvent(
      new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true }),
    );
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
  });
});
