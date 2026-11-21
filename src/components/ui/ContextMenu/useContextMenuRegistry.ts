import { useCallback, useRef } from "react";

/** Maps list rows to the openers of their context menus. */
export interface ContextMenuRegistry<K extends string | number> {
  /**
   * Registers the menu opener of the row with `key`.
   *
   * @returns The unregistration, which leaves a newer opener for the same key in place.
   */
  register: (key: K, openAt: (row: HTMLElement) => void) => () => void;
  /** Opens the menu of the row with `key` next to `row`; does nothing for an unknown key. */
  open: (key: K, row: HTMLElement) => void;
}

/**
 * Lets a list open a row's context menu from the keyboard.
 *
 * @returns `register` and `open`, both stable across renders.
 */
export function useContextMenuRegistry<K extends string | number>(): ContextMenuRegistry<K> {
  const openers = useRef(new Map<K, (row: HTMLElement) => void>());

  const register = useCallback((key: K, openAt: (row: HTMLElement) => void) => {
    openers.current.set(key, openAt);
    return () => {
      if (openers.current.get(key) === openAt) {
        openers.current.delete(key);
      }
    };
  }, []);

  const open = useCallback((key: K, row: HTMLElement) => {
    openers.current.get(key)?.(row);
  }, []);

  return { register, open };
}
