import { useCallback, useEffect, useRef } from "react";

/** The handlers {@link usePointerFocusRelease} returns for one element. */
export interface PointerFocusRelease {
  /** For the element's `onPointerDown`. */
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  /**
   * For the element's `onFocus`, called before anything else there.
   *
   * @returns Whether it blurred the element, which a pointer press had focused.
   */
  onFocus: (e: React.FocusEvent<HTMLElement>) => boolean;
  /** Forgets the current press, so that a focus the app itself requests during it is kept. */
  forgetPress: () => void;
}

/**
 * Keeps a pointer from leaving focus on an element that is focusable only for the keyboard, so
 * that mouse use does not leave the reader's keys swallowed. A press that focuses the element
 * blurs it again; a press while focus is inside the element blurs that focus on pointerup, so
 * that a scrollbar drag is not cut short, unless the press moved it to a tab stop (a field, a
 * button) other than the element.
 *
 * @returns The handlers to put on the element.
 */
export function usePointerFocusRelease(): PointerFocusRelease {
  const pressedRef = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const element = e.currentTarget;
    const focusedAtPress = document.activeElement;
    // A press inside the focused element fires no focus event on it.
    const focusInside = element.contains(focusedAtPress);
    pressedRef.current = !focusInside;
    stopRef.current?.();
    const stop = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", stop);
      stopRef.current = null;
      // A press that focused nothing must not blur a later keyboard focus.
      pressedRef.current = false;
    };
    const release = () => {
      stop();
      const focused = document.activeElement;
      if (
        focusInside &&
        focused instanceof HTMLElement &&
        element.contains(focused) &&
        (focused === element || focused === focusedAtPress || focused.tabIndex < 0)
      ) {
        focused.blur();
      }
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", stop);
    stopRef.current = stop;
  }, []);
  useEffect(() => () => stopRef.current?.(), []);

  const onFocus = useCallback((e: React.FocusEvent<HTMLElement>) => {
    const pressed = pressedRef.current;
    pressedRef.current = false;
    if (!pressed || e.target !== e.currentTarget) {
      return false;
    }
    e.currentTarget.blur();
    return true;
  }, []);

  const forgetPress = useCallback(() => {
    pressedRef.current = false;
  }, []);

  return { onPointerDown, onFocus, forgetPress };
}
