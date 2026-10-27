/**
 * How an item (a tag, a collection, …) stands across the books a dialog edits: on all of
 * them, on none, or on some (`mixed`, left as each book has it unless the user changes it).
 */
export type CheckState = "checked" | "unchecked" | "mixed";

/**
 * Works out each item's state from the items the books already have.
 *
 * @param idsPerBook - The item ids of each edited book.
 * @param ids - The items the dialog lists.
 * @returns Each listed item's state.
 */
export function initialCheckStates(idsPerBook: number[][], ids: number[]): Map<number, CheckState> {
  const states = new Map<number, CheckState>();
  for (const id of ids) {
    const carriers = idsPerBook.filter((bookIds) => bookIds.includes(id)).length;
    states.set(
      id,
      carriers === 0 ? "unchecked" : carriers === idsPerBook.length ? "checked" : "mixed",
    );
  }
  return states;
}

/**
 * The state a click moves an item to: `unchecked → checked → unchecked`, and an item that
 * started mixed also returns to mixed (`mixed → checked → unchecked → mixed`).
 *
 * @param current - The item's state now.
 * @param initial - Its state when the dialog opened.
 * @returns Its state after the click.
 */
export function nextCheckState(current: CheckState, initial: CheckState): CheckState {
  if (current === "checked") {
    return "unchecked";
  }
  if (current === "unchecked" && initial === "mixed") {
    return "mixed";
  }
  return "checked";
}

/**
 * The item sets to save: each book gains the checked items, loses the unchecked ones and
 * keeps its mixed ones as they are.
 *
 * @param idsPerBook - Each edited book's current item ids, by book id.
 * @param states - Each item's chosen state.
 * @returns The books whose items change, with their new item ids in ascending order.
 */
export function applyCheckStates(
  idsPerBook: Map<number, number[]>,
  states: Map<number, CheckState>,
): { bookId: number; ids: number[] }[] {
  const updates: { bookId: number; ids: number[] }[] = [];
  for (const [bookId, current] of idsPerBook) {
    const next = new Set(current);
    for (const [id, state] of states) {
      if (state === "checked") next.add(id);
      if (state === "unchecked") next.delete(id);
    }
    const ids = [...next].sort((a, b) => a - b);
    const unchanged = ids.length === current.length && ids.every((id) => current.includes(id));
    if (!unchanged) {
      updates.push({ bookId, ids });
    }
  }
  return updates;
}
