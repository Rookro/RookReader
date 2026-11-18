import { type Combo, parseCombo, sameCombo } from "./combo";

/** An action that turns pages. */
export type PageAction = "pageLeft" | "pageRight" | "nextPage" | "previousPage";

/** An action the reader performs on a key or mouse button. */
export type ReaderAction = PageAction;

/** A key or button combo, in the loupe's notation, bound to an action. */
export interface Binding {
  combo: string;
  action: ReaderAction;
}

/** The reader's built-in bindings. */
export const READER_BINDINGS: readonly Binding[] = [
  { combo: "ArrowLeft", action: "pageLeft" },
  { combo: "ArrowRight", action: "pageRight" },
  { combo: "MouseLeft", action: "nextPage" },
  { combo: "MouseRight", action: "previousPage" },
];

/** Actions that run again while their key is held down. */
export const REPEATABLE_ACTIONS: ReadonlySet<ReaderAction> = new Set<ReaderAction>([
  "pageLeft",
  "pageRight",
  "nextPage",
  "previousPage",
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

const PARSED_READER_BINDINGS = parseBindings(READER_BINDINGS);

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
  const table = bindings === READER_BINDINGS ? PARSED_READER_BINDINGS : parseBindings(bindings);
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
