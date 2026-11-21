import type { ClickToTurnPagesMode } from "../../../types/AppSettings";
import { type Combo, parseCombo, sameCombo } from "./combo";

/** An action that moves through pages. */
export type PageAction =
  | "pageLeft"
  | "pageRight"
  | "nextPage"
  | "previousPage"
  | "firstPage"
  | "lastPage";

/** An action the reader view performs whichever reader is open. */
export type CommonAction =
  | "toggleSpread"
  | "shiftSpread"
  | "toggleDirection"
  | "toggleBookmark"
  | "toggleSidePane"
  | "historyBack"
  | "historyForward"
  | "focusSidePane"
  | "focusReader"
  | "nextSidePanel"
  | "previousSidePanel";

/** An action the reader performs on a key or mouse button. */
export type ReaderAction = PageAction | CommonAction;

/** A key or button combo, in the loupe's notation, bound to an action. */
export interface Binding {
  combo: string;
  action: ReaderAction;
}

/** The reader's built-in bindings. */
export const READER_BINDINGS: readonly Binding[] = [
  { combo: "ArrowLeft", action: "pageLeft" },
  { combo: "ArrowRight", action: "pageRight" },
  { combo: "Space", action: "nextPage" },
  { combo: "PageDown", action: "nextPage" },
  { combo: "ArrowDown", action: "nextPage" },
  { combo: "Shift+Space", action: "previousPage" },
  { combo: "PageUp", action: "previousPage" },
  { combo: "ArrowUp", action: "previousPage" },
  { combo: "Home", action: "firstPage" },
  { combo: "End", action: "lastPage" },
  { combo: "S", action: "toggleSpread" },
  { combo: "Shift+S", action: "shiftSpread" },
  { combo: "D", action: "toggleDirection" },
  { combo: "B", action: "toggleBookmark" },
  { combo: "P", action: "toggleSidePane" },
  { combo: "MouseBack", action: "historyBack" },
  { combo: "MouseForward", action: "historyForward" },
  { combo: "F6", action: "focusSidePane" },
];

/** The bindings of keys pressed in the side pane, where no reader binding applies. */
export const SIDE_PANE_BINDINGS: readonly Binding[] = [
  { combo: "F6", action: "focusReader" },
  { combo: "Escape", action: "focusReader" },
  { combo: "Ctrl+Tab", action: "nextSidePanel" },
  { combo: "Ctrl+Shift+Tab", action: "previousSidePanel" },
];

/** A click binding: a button, optionally limited to a horizontal range of the reading area. */
export interface ClickBinding {
  button: "left" | "right";
  /** `[from, to)` as fractions of the reading area's width (a zone ending at 1 also contains 1); the whole area when absent. */
  zone?: readonly [number, number];
  action: ReaderAction;
}

/** The click bindings of each "Click to turn pages" mode. */
export const CLICK_BINDINGS: Record<ClickToTurnPagesMode, readonly ClickBinding[]> = {
  anywhere: [
    { button: "left", action: "nextPage" },
    { button: "right", action: "previousPage" },
  ],
  bySide: [
    { button: "left", zone: [0, 0.5], action: "pageLeft" },
    { button: "left", zone: [0.5, 1], action: "pageRight" },
    { button: "right", action: "previousPage" },
  ],
};

// Half-open, except that 1 belongs to a zone ending at 1.
const inZone = (x: number, [from, to]: readonly [number, number]): boolean =>
  x >= from && (x < to || (x === 1 && to === 1));

/**
 * Finds the action bound to a click: the first row of the mode's table for the button whose zone,
 * if any, contains the position. A zoned row never matches without a position.
 *
 * @param mode - The "Click to turn pages" mode.
 * @param button - The clicked button.
 * @param x - Where the click landed, as a fraction of the reading area's width, or null when unknown.
 * @returns The bound action, or null when nothing matches.
 */
export const findClickAction = (
  mode: ClickToTurnPagesMode,
  button: "left" | "right",
  x: number | null,
): ReaderAction | null =>
  CLICK_BINDINGS[mode].find(
    (b) => b.button === button && (!b.zone || (x !== null && inZone(x, b.zone))),
  )?.action ?? null;

/** Actions that run again while their key is held down. */
export const REPEATABLE_ACTIONS: ReadonlySet<ReaderAction> = new Set<ReaderAction>([
  "pageLeft",
  "pageRight",
  "nextPage",
  "previousPage",
  "firstPage",
  "lastPage",
]);

interface ParsedBinding {
  combo: Combo;
  action: ReaderAction;
}

const parseBindings = (bindings: readonly Binding[]): ParsedBinding[] =>
  bindings.flatMap(({ combo, action }) => {
    const parsed = parseCombo(combo);
    return parsed ? [{ combo: parsed, action }] : [];
  });

const parsedTables = new Map<readonly Binding[], ParsedBinding[]>();

const parsedTable = (bindings: readonly Binding[]): ParsedBinding[] => {
  let table = parsedTables.get(bindings);
  if (!table) {
    table = parseBindings(bindings);
    parsedTables.set(bindings, table);
  }
  return table;
};

/**
 * Finds the action bound to an input: an exact match first (so a Shift binding wins), then, for an
 * input with only Shift held, the binding without Shift.
 *
 * @param input - The combo of a keydown or mousedown.
 * @param bindings - The table to search; the reader's built-in bindings by default.
 * @returns The bound action, or null when nothing matches.
 */
export const findAction = (
  input: Combo,
  bindings: readonly Binding[] = READER_BINDINGS,
): ReaderAction | null => {
  const table = parsedTable(bindings);
  const exact = table.find((b) => sameCombo(b.combo, input));
  if (exact) {
    return exact.action;
  }
  if (!input.shift || input.ctrl || input.alt || input.meta) {
    return null;
  }
  const unshifted = { ...input, shift: false };
  return table.find((b) => sameCombo(b.combo, unshifted))?.action ?? null;
};
