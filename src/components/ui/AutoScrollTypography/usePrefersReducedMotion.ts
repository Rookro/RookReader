import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribers = new Set<() => void>();

let mediaQuery: MediaQueryList | null = null;
let matches = false;

function handleChange() {
  matches = mediaQuery?.matches ?? false;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  if (subscribers.size === 0) {
    mediaQuery = globalThis.matchMedia?.(QUERY) ?? null;
    matches = mediaQuery?.matches ?? false;
    mediaQuery?.addEventListener("change", handleChange);
  }
  subscribers.add(notify);

  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) {
      mediaQuery?.removeEventListener("change", handleChange);
      mediaQuery = null;
    }
  };
}

function getSnapshot(): boolean {
  return matches;
}

/**
 * Reports whether the user asked for reduced motion.
 *
 * Unlike MUI's `useMediaQuery`, every caller shares a single `matchMedia`
 * listener, so rendering one of these per bookshelf card does not register
 * hundreds of them.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
