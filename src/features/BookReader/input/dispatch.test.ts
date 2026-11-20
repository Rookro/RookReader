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
  historyBack: vi.fn(),
  historyForward: vi.fn(),
  focusSidePane: vi.fn(),
  focusReader: vi.fn(),
  nextSidePanel: vi.fn(),
  previousSidePanel: vi.fn(),
});

const sidePane = (
  overrides: Partial<DispatchContext["sidePane"]> = {},
): DispatchContext["sidePane"] => ({
  isHidden: false,
  isKeyboardInPane: () => false,
  recoverFocus: vi.fn(),
  ...overrides,
});

const ctx: DispatchContext = {
  isReaderActive: true,
  direction: "ltr",
  loupeToggle: null,
  reader: null,
  common: commonActions(),
  sidePane: sidePane(),
};

const reader = () => ({
  nextPage: vi.fn<PageMove>(() => true),
  previousPage: vi.fn<PageMove>(() => true),
  firstPage: vi.fn<() => void>(),
  lastPage: vi.fn<() => void>(),
  toggleLoupe: vi.fn<(at?: PointerPosition) => void>(),
});

afterEach(() => {
  document.body.innerHTML = "";
});

/** Appends an element inside a side-pane container in the body. */
const paneElement = (tagName = "button") => {
  const pane = document.createElement("div");
  pane.setAttribute("data-side-pane", "");
  const element = document.createElement(tagName);
  pane.appendChild(element);
  document.body.appendChild(pane);
  return element;
};

/** Sets an input event's target, as if it had been dispatched there. */
const at = <T extends { event: Event }>(target: EventTarget, input: T): T => {
  Object.defineProperty(input.event, "target", { value: target });
  return input;
};

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

  it.each([
    { k: "Home", jump: "firstPage" },
    { k: "End", jump: "lastPage" },
  ] as const)("$k → $jump, also while held", ({ k, jump }) => {
    const r = reader();
    const input = key(k);
    expect(dispatchReaderInput(input, { ...ctx, reader: r })).toBe(true);
    expect(input.event.defaultPrevented).toBe(true);
    dispatchReaderInput(key(k, { repeat: true }), { ...ctx, reader: r });
    expect(r[jump]).toHaveBeenCalledTimes(2);
    expect(r.nextPage).not.toHaveBeenCalled();
    expect(r.previousPage).not.toHaveBeenCalled();
  });

  it("does nothing for Home and End while no reader is registered, but claims them", () => {
    const common = commonActions();
    for (const k of ["Home", "End"]) {
      const input = key(k);
      expect(dispatchReaderInput(input, { ...ctx, common })).toBe(true);
      expect(input.event.defaultPrevented).toBe(true);
    }
    for (const fn of Object.values(common)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("dispatchReaderInput: side buttons", () => {
  it.each([
    { b: 3, action: "historyBack" },
    { b: 4, action: "historyForward" },
  ] as const)("button $b → $action, anywhere in the reader view", ({ b, action }) => {
    for (const inReadingArea of [true, false]) {
      const common = commonActions();
      const input = button(b, inReadingArea);
      expect(dispatchReaderInput(input, { ...ctx, reader: reader(), common })).toBe(true);
      expect(input.event.defaultPrevented).toBe(true);
      expect(common[action]).toHaveBeenCalledTimes(1);
    }
  });

  it("goes back in the history while no reader is registered", () => {
    const common = commonActions();
    expect(dispatchReaderInput(button(3), { ...ctx, common })).toBe(true);
    expect(common.historyBack).toHaveBeenCalledTimes(1);
  });

  it("toggles only the loupe when its button is MouseBack, over the reading area", () => {
    const r = reader();
    const common = commonActions();
    const loupe = { ...ctx, loupeToggle: parseCombo("MouseBack"), reader: r, common };

    dispatchReaderInput(button(3, true), loupe);
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
    expect(common.historyBack).not.toHaveBeenCalled();

    dispatchReaderInput(button(3, false), loupe);
    expect(r.toggleLoupe).toHaveBeenCalledTimes(1);
    expect(common.historyBack).toHaveBeenCalledTimes(1);
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
      reader: { nextPage, previousPage, firstPage: vi.fn(), lastPage: vi.fn() },
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

describe("dispatchReaderInput: side pane", () => {
  it("runs no reader shortcut for a key from the side pane", () => {
    const r = reader();
    const common = commonActions();
    const row = paneElement();
    for (const k of ["ArrowDown", " ", "s", "b", "p"]) {
      const input = at(row, key(k));
      expect(dispatchReaderInput(input, { ...ctx, reader: r, common })).toBe(false);
      expect(input.event.defaultPrevented).toBe(false);
    }
    expect(r.nextPage).not.toHaveBeenCalled();
    for (const fn of Object.values(common)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("does not toggle the loupe from the side pane", () => {
    const r = reader();
    const input = at(paneElement(), key("l"));
    expect(dispatchReaderInput(input, { ...ctx, loupeToggle: parseCombo("L"), reader: r })).toBe(
      false,
    );
    expect(r.toggleLoupe).not.toHaveBeenCalled();
  });

  it("enters the pane with F6 from the reader", () => {
    const common = commonActions();
    const input = key("F6");
    expect(dispatchReaderInput(input, { ...ctx, common })).toBe(true);
    expect(common.focusSidePane).toHaveBeenCalledTimes(1);
    expect(input.event.defaultPrevented).toBe(true);
  });

  it.each([
    { name: "F6", k: "F6", init: {} },
    { name: "Shift+F6", k: "F6", init: { shiftKey: true } },
    { name: "Escape", k: "Escape", init: {} },
  ])("returns to the reader with $name from the pane", ({ k, init }) => {
    const common = commonActions();
    const input = at(paneElement(), key(k, init));
    expect(dispatchReaderInput(input, { ...ctx, common })).toBe(true);
    expect(common.focusReader).toHaveBeenCalledTimes(1);
    expect(common.focusSidePane).not.toHaveBeenCalled();
    expect(input.event.defaultPrevented).toBe(true);
  });

  it("enters instead with F6 from the tab strip of a hidden pane", () => {
    const common = commonActions();
    const input = at(paneElement(), key("F6"));
    expect(
      dispatchReaderInput(input, { ...ctx, common, sidePane: sidePane({ isHidden: true }) }),
    ).toBe(true);
    expect(common.focusSidePane).toHaveBeenCalledTimes(1);
    expect(common.focusReader).not.toHaveBeenCalled();
  });

  it("switches panels with Ctrl+Tab and Ctrl+Shift+Tab only in the pane", () => {
    const common = commonActions();
    const next = { ctrlKey: true };
    const previous = { ctrlKey: true, shiftKey: true };

    expect(dispatchReaderInput(at(paneElement(), key("Tab", next)), { ...ctx, common })).toBe(true);
    expect(dispatchReaderInput(at(paneElement(), key("Tab", previous)), { ...ctx, common })).toBe(
      true,
    );
    expect(common.nextSidePanel).toHaveBeenCalledTimes(1);
    expect(common.previousSidePanel).toHaveBeenCalledTimes(1);

    expect(dispatchReaderInput(key("Tab", next), { ...ctx, common })).toBe(false);
    expect(dispatchReaderInput(key("Tab", previous), { ...ctx, common })).toBe(false);
    expect(common.nextSidePanel).toHaveBeenCalledTimes(1);
    expect(common.previousSidePanel).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "F6", init: {}, k: "F6" },
    { name: "Ctrl+Tab", init: { ctrlKey: true }, k: "Tab" },
  ])("claims a held $name in the pane without repeating it", ({ k, init }) => {
    const common = commonActions();
    const input = at(paneElement(), key(k, { ...init, repeat: true }));
    expect(dispatchReaderInput(input, { ...ctx, common })).toBe(true);
    expect(input.event.defaultPrevented).toBe(true);
    for (const fn of Object.values(common)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each([
    { name: "a menu", attribute: "role", value: "menu" },
    { name: "a modal", attribute: "class", value: "MuiModal-root" },
  ])("skips the pane commands while $name is open", ({ attribute, value }) => {
    const common = commonActions();
    const modal = document.createElement("div");
    modal.setAttribute(attribute, value);
    document.body.appendChild(modal);
    const input = at(paneElement(), key("Escape"));
    expect(dispatchReaderInput(input, { ...ctx, common })).toBe(false);
    expect(input.event.defaultPrevented).toBe(false);
    expect(common.focusReader).not.toHaveBeenCalled();
  });

  it("runs the pane commands from a text field in the pane", () => {
    const common = commonActions();
    expect(dispatchReaderInput(at(paneElement("input"), key("F6")), { ...ctx, common })).toBe(true);
    expect(common.focusReader).toHaveBeenCalledTimes(1);
  });

  it("skips an Escape a pane field already handled", () => {
    const common = commonActions();
    const input = at(paneElement("input"), key("Escape"));
    input.event.preventDefault();
    expect(dispatchReaderInput(input, { ...ctx, common })).toBe(false);
    expect(common.focusReader).not.toHaveBeenCalled();
  });

  it.each([
    { name: "isComposing", init: { isComposing: true } },
    { name: "keyCode 229", init: { keyCode: 229 } },
  ])("ignores keys during IME composition ($name)", ({ init }) => {
    const r = reader();
    const common = commonActions();
    expect(dispatchReaderInput(key("ArrowDown", init), { ...ctx, reader: r, common })).toBe(false);
    expect(dispatchReaderInput(at(paneElement(), key("F6", init)), { ...ctx, common })).toBe(false);
    expect(r.nextPage).not.toHaveBeenCalled();
    expect(common.focusReader).not.toHaveBeenCalled();
  });

  it("treats a key on the body as the pane's while the keyboard is in the pane", () => {
    const r = reader();
    const recoverFocus = vi.fn();
    const input = at(document.body, key("ArrowDown"));
    expect(
      dispatchReaderInput(input, {
        ...ctx,
        reader: r,
        sidePane: sidePane({ isKeyboardInPane: () => true, recoverFocus }),
      }),
    ).toBe(true);
    expect(recoverFocus).toHaveBeenCalledTimes(1);
    expect(input.event.defaultPrevented).toBe(true);
    expect(r.nextPage).not.toHaveBeenCalled();
  });

  it("keeps a key on the EPUB iframe's body in the reader", () => {
    const r = reader();
    const iframeBody = document.implementation.createHTMLDocument("").body;
    expect(
      dispatchReaderInput(at(iframeBody, key("ArrowDown")), {
        ...ctx,
        reader: r,
        sidePane: sidePane({ isKeyboardInPane: () => true }),
      }),
    ).toBe(true);
    expect(r.nextPage).toHaveBeenCalledTimes(1);
  });

  it("still lets the side buttons go back over the pane", () => {
    const common = commonActions();
    expect(dispatchReaderInput(at(paneElement(), button(3, false)), { ...ctx, common })).toBe(true);
    expect(common.historyBack).toHaveBeenCalledTimes(1);
  });
});
