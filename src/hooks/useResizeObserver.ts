import { debounce } from "@mui/material";
import { type RefObject, useEffect, useMemo, useState } from "react";

/**
 * A custom hook that observes the width of an element using ResizeObserver.
 *
 * It provides a debounced width update to prevent excessive re-renders,
 * but updates immediately during the initial visibility phase to ensure a smooth UI.
 *
 * @param ref - The React ref of the element to observe.
 * @param debounceMs - The debounce delay in milliseconds. Defaults to 100ms.
 * @returns The observed width of the element.
 */
export function useResizeObserver(ref: RefObject<HTMLElement | null>, debounceMs = 100) {
  const [width, setWidth] = useState(0);

  const debouncedUpdateWidth = useMemo(
    () =>
      debounce((currentWidth: number) => {
        setWidth(currentWidth);
      }, debounceMs),
    [debounceMs],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let previousWidth = 0;
    let visibleTime = 0;

    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0 && entries[0]) {
        const newWidth = entries[0].contentRect.width;

        // Skip if width is 0 or hasn't changed
        if (newWidth <= 0 || newWidth === previousWidth) {
          return;
        }

        const now = performance.now();

        if (previousWidth === 0) {
          // Initial visibility: update immediately
          visibleTime = now;
          debouncedUpdateWidth.clear();
          setWidth(newWidth);
        } else if (now - visibleTime < 200) {
          // Shortly after initial visibility: update immediately to avoid lag
          debouncedUpdateWidth.clear();
          setWidth(newWidth);
        } else {
          // Subsequent changes: use debounce
          debouncedUpdateWidth(newWidth);
        }

        previousWidth = newWidth;
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      debouncedUpdateWidth.clear();
    };
  }, [ref, debouncedUpdateWidth]);

  return width;
}
