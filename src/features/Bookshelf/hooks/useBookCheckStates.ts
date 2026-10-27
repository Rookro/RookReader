import { error as logError } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyCheckStates,
  type CheckState,
  initialCheckStates,
  nextCheckState,
} from "../utils/checkSelection";

/** Parameters for {@link useBookCheckStates}. */
export interface UseBookCheckStatesParams {
  /** Whether the dialog is open; the books' items are loaded each time it opens. */
  open: boolean;
  /** The books the dialog edits. */
  bookIds: number[];
  /** The items the dialog lists. */
  ids: number[];
  /** Loads the ids of the items a book has. */
  load: (bookId: number) => Promise<number[]>;
  /** The message logged with the error when loading fails. */
  loadErrorMessage: string;
}

/** The check states of a dialog that sets items (tags, collections, …) on books. */
export interface BookCheckStates {
  /** Returns an item's state. */
  stateOf: (id: number) => CheckState;
  /** Moves an item to its next state. */
  toggle: (id: number) => void;
  /**
   * The books whose items change, with their new item ids, or null while loading or after
   * a failed load: saving without every book's items would overwrite items the dialog
   * never saw.
   */
  changes: { bookId: number; ids: number[] }[] | null;
}

/**
 * Tracks which listed items the edited books have, as checked, mixed or unchecked states.
 *
 * @param params - The books, the listed items and how to load the books' items.
 * @returns The states, a toggle, and the changes to save.
 */
export function useBookCheckStates({
  open,
  bookIds,
  ids,
  load,
  loadErrorMessage,
}: UseBookCheckStatesParams): BookCheckStates {
  const [idsPerBook, setIdsPerBook] = useState<Map<number, number[]> | null>(null);
  const [initialStates, setInitialStates] = useState<Map<number, CheckState>>(new Map());
  const [states, setStates] = useState<Map<number, CheckState>>(new Map());

  // The item list only seeds the states; an item created while the dialog is open starts
  // unchecked rather than reloading every book's items.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the books change.
  useEffect(() => {
    if (!open) {
      return;
    }
    setIdsPerBook(null);
    setInitialStates(new Map());
    setStates(new Map());
    if (bookIds.length === 0) {
      return;
    }
    let stale = false;
    Promise.all(bookIds.map((bookId) => load(bookId)))
      .then((loaded) => {
        if (stale) return;
        const initial = initialCheckStates(loaded, ids);
        setIdsPerBook(new Map(bookIds.map((bookId, i) => [bookId, loaded[i]])));
        setInitialStates(initial);
        setStates(initial);
      })
      .catch((e) => {
        logError(`${loadErrorMessage}: ${e}`);
      });
    return () => {
      // Ignore a late response after the dialog reopened for other books.
      stale = true;
    };
  }, [open, bookIds]);

  const stateOf = useCallback((id: number) => states.get(id) ?? "unchecked", [states]);

  const toggle = useCallback(
    (id: number) => {
      setStates((current) =>
        new Map(current).set(
          id,
          nextCheckState(current.get(id) ?? "unchecked", initialStates.get(id) ?? "unchecked"),
        ),
      );
    },
    [initialStates],
  );

  const changes = useMemo(
    () => (idsPerBook === null ? null : applyCheckStates(idsPerBook, states)),
    [idsPerBook, states],
  );

  return { stateOf, toggle, changes };
}
