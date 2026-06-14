/** A navigable history stack: a list of entries plus the current index. */
export interface NavigationHistory {
  /** The ordered list of visited entries. */
  history: string[];
  /** The index of the current entry within {@link history}. */
  historyIndex: number;
}

/**
 * Pushes `value` onto the stack unless it equals the current entry (consecutive-
 * duplicate suppression). Any forward entries beyond the current index are first
 * truncated. Mutates `stack` in place (safe with Immer drafts).
 *
 * @param stack - The history stack to update.
 * @param value - The entry to push.
 * @returns `true` if the stack changed, `false` if the push was suppressed.
 */
export const pushHistory = (stack: NavigationHistory, value: string): boolean => {
  if (stack.history.length > 0 && stack.history[stack.historyIndex] === value) {
    return false;
  }
  if (stack.historyIndex !== stack.history.length - 1) {
    stack.history = stack.history.slice(0, stack.historyIndex + 1);
  }
  stack.history.push(value);
  stack.historyIndex = stack.history.length - 1;
  return true;
};

/**
 * Moves one entry back in the stack.
 *
 * @param stack - The history stack to update.
 * @returns `true` if the index changed, `false` if already at the start.
 */
export const goBackHistory = (stack: NavigationHistory): boolean => {
  if (stack.historyIndex > 0) {
    stack.historyIndex -= 1;
    return true;
  }
  return false;
};

/**
 * Moves one entry forward in the stack.
 *
 * @param stack - The history stack to update.
 * @returns `true` if the index changed, `false` if already at the end.
 */
export const goForwardHistory = (stack: NavigationHistory): boolean => {
  if (stack.historyIndex < stack.history.length - 1) {
    stack.historyIndex += 1;
    return true;
  }
  return false;
};
