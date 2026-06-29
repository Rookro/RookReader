import { debounce } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * A custom hook to manage pane sizes in localStorage.
 *
 * @param storageKey The key used to store the sizes in localStorage.
 * @returns An object containing the current pane sizes and a debounced function to update them.
 */
export function usePaneSizes(storageKey: string) {
  const paneSizes = useMemo<number[] | undefined>(() => {
    const storedSizes = localStorage.getItem(storageKey);
    if (storedSizes) {
      try {
        const sizes = JSON.parse(storedSizes);
        if (Array.isArray(sizes) && sizes.every((size) => typeof size === "number")) {
          return sizes;
        }
      } catch (ex) {
        error(`Failed to parse ${storageKey}: ${ex}`);
      }
    }
    return undefined;
  }, [storageKey]);

  const latestSizesRef = useRef<number[] | null>(null);

  const debouncedWrite = useMemo(
    () =>
      debounce((sizes: number[]) => {
        localStorage.setItem(storageKey, JSON.stringify(sizes));
      }, 500),
    [storageKey],
  );

  const setPaneSizes = useCallback(
    (sizes: number[]) => {
      latestSizesRef.current = sizes;
      debouncedWrite(sizes);
    },
    [debouncedWrite],
  );

  useEffect(() => {
    return () => {
      // Flush the pending write on unmount: `debounce(...).clear()` only cancels,
      // which would lose the last resize made within the debounce window.
      debouncedWrite.clear();
      if (latestSizesRef.current) {
        localStorage.setItem(storageKey, JSON.stringify(latestSizesRef.current));
      }
    };
  }, [debouncedWrite, storageKey]);

  return { paneSizes, setPaneSizes };
}
