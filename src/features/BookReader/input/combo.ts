/** A key or mouse button with its modifiers, in the loupe's notation. */
export interface Combo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

const MODIFIER_KEYS = ["Control", "Alt", "Shift", "Meta"];

// The modifiers prefix is matched explicitly so that the "+" key itself parses ("Shift++").
const NOTATION = /^((?:(?:Ctrl|Alt|Shift|Meta)\+)*)(.+)$/;

/**
 * `" "` → `"Space"`, one character → upper case, anything else unchanged.
 *
 * @param key - A `KeyboardEvent.key` or the key part of a notation.
 * @returns The key in the loupe's notation.
 */
export const normalizeKey = (key: string): string => {
  if (key === " ") {
    return "Space";
  }
  return key.length === 1 ? key.toUpperCase() : key;
};

/**
 * Parses `"Ctrl+Shift+L"`; null for an empty string.
 *
 * @param notation - A key or button combo as the settings record it.
 * @returns The combo, or null when the notation is empty.
 */
export const parseCombo = (notation: string): Combo | null => {
  const match = NOTATION.exec(notation);
  if (!match) {
    return null;
  }
  const modifiers = match[1].split("+");
  return {
    key: normalizeKey(match[2]),
    ctrl: modifiers.includes("Ctrl"),
    alt: modifiers.includes("Alt"),
    shift: modifiers.includes("Shift"),
    meta: modifiers.includes("Meta"),
  };
};

/**
 * 1 → `MouseMiddle`, 3 → `MouseBack`, 4 → `MouseForward`, otherwise null.
 *
 * @param button - A `MouseEvent.button`.
 * @returns The button's name, or null for a button that cannot be bound.
 */
export const mouseButtonName = (button: number): string | null => {
  switch (button) {
    case 1:
      return "MouseMiddle";
    case 3:
      return "MouseBack";
    case 4:
      return "MouseForward";
    default:
      return null;
  }
};

/**
 * The combo of a keydown (null for a modifier-only key) or a mousedown (null for buttons 0 and 2).
 *
 * @param e - A keydown or mousedown event, possibly from an iframe's realm.
 * @returns The combo, or null when the event cannot be bound.
 */
export const comboOf = (e: KeyboardEvent | MouseEvent): Combo | null => {
  // `instanceof` fails for events from an iframe, which belong to another realm.
  let key: string | null;
  if ("key" in e) {
    key = MODIFIER_KEYS.includes(e.key) ? null : normalizeKey(e.key);
  } else {
    key = mouseButtonName(e.button);
  }
  if (key === null) {
    return null;
  }
  return { key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
};

/**
 * Exact equality of key and all four modifiers.
 *
 * @param a - A combo.
 * @param b - Another combo.
 * @returns Whether both are the same combo.
 */
export const sameCombo = (a: Combo, b: Combo): boolean =>
  a.key === b.key &&
  a.ctrl === b.ctrl &&
  a.alt === b.alt &&
  a.shift === b.shift &&
  a.meta === b.meta;
