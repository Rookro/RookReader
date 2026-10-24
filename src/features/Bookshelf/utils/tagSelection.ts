/**
 * How a tag stands across the books a tag dialog edits: on all of them, on none, or on
 * some (`mixed`, left as each book has it unless the user changes it).
 */
export type TagCheckState = "checked" | "unchecked" | "mixed";

/**
 * Works out each tag's state from the tags the books already carry.
 *
 * @param tagIdsPerBook - The tag ids of each edited book.
 * @param tagIds - The tags the dialog lists.
 * @returns Each listed tag's state.
 */
export function initialTagStates(
  tagIdsPerBook: number[][],
  tagIds: number[],
): Map<number, TagCheckState> {
  const states = new Map<number, TagCheckState>();
  for (const tagId of tagIds) {
    const carriers = tagIdsPerBook.filter((ids) => ids.includes(tagId)).length;
    states.set(
      tagId,
      carriers === 0 ? "unchecked" : carriers === tagIdsPerBook.length ? "checked" : "mixed",
    );
  }
  return states;
}

/**
 * The state a click moves a tag to: `unchecked → checked → unchecked`, and a tag that
 * started mixed also returns to mixed (`mixed → checked → unchecked → mixed`).
 *
 * @param current - The tag's state now.
 * @param initial - Its state when the dialog opened.
 * @returns Its state after the click.
 */
export function nextTagState(current: TagCheckState, initial: TagCheckState): TagCheckState {
  if (current === "checked") {
    return "unchecked";
  }
  if (current === "unchecked" && initial === "mixed") {
    return "mixed";
  }
  return "checked";
}

/**
 * The tag sets to save: each book gains the checked tags, loses the unchecked ones and
 * keeps its mixed ones as they are.
 *
 * @param tagIdsPerBook - Each edited book's current tag ids, by book id.
 * @param states - Each tag's chosen state.
 * @returns The books whose tags change, with their new tag ids in ascending order.
 */
export function applyTagStates(
  tagIdsPerBook: Map<number, number[]>,
  states: Map<number, TagCheckState>,
): { bookId: number; tagIds: number[] }[] {
  const updates: { bookId: number; tagIds: number[] }[] = [];
  for (const [bookId, current] of tagIdsPerBook) {
    const next = new Set(current);
    for (const [tagId, state] of states) {
      if (state === "checked") next.add(tagId);
      if (state === "unchecked") next.delete(tagId);
    }
    const tagIds = [...next].sort((a, b) => a - b);
    const unchanged =
      tagIds.length === current.length && tagIds.every((id) => current.includes(id));
    if (!unchanged) {
      updates.push({ bookId, tagIds });
    }
  }
  return updates;
}
