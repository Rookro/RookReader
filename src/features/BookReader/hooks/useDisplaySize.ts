import { debounce } from "@mui/material";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

/** How long a resize settles before it is reported. */
const DEBOUNCE_MS = 150;

/** The reader's viewport in device pixels. */
export interface DisplaySize {
  /** The width the reader draws a page into. */
  width: number;
  /** The height the reader draws a page into. */
  height: number;
}

/** The size of a viewer that has not measured itself yet. */
export const UNMEASURED: DisplaySize = { width: 0, height: 0 };

/**
 * The element's size in device pixels, to the nearest pixel.
 *
 * Exact, not rounded to a coarser step. A page even a few percent larger than its box is
 * scaled by the browser at a ratio just under 1, and on a screentone that is a beat: the
 * sample phase drifts across the page, so the tone's contrast rises and falls every
 * 1 / (1 / ratio - 1) pixels — 42 px at 1536 / 1500 — as visible bands. At the exact
 * size the same drift takes the whole page to complete once.
 */
const measure = (element: HTMLElement, ratio: number): DisplaySize => {
  const { width, height } = element.getBoundingClientRect();
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
};

/**
 * Measures the element the pages are drawn into, in device pixels.
 *
 * Separate from {@link useResizeObserver}, which reports CSS width only and is shared
 * with the bookshelf: a page is fitted on both axes, and it is device pixels that decide
 * whether the browser has to scale it.
 *
 * @param ref The reader area to observe.
 * @param debounceMs How long a resize settles before it is reported.
 * @returns The viewport, or {@link UNMEASURED} before the first measurement.
 */
export function useDisplaySize(
  ref: RefObject<HTMLElement | null>,
  debounceMs = DEBOUNCE_MS,
): DisplaySize {
  const [size, setSize] = useState<DisplaySize>(UNMEASURED);
  const [ratio, setRatio] = useState(() => window.devicePixelRatio || 1);

  // Same size, same object: every consumer of this hook reloads the book when it
  // changes, so a measurement that lands on the size already reported must not be a new
  // object. It is also what keeps this hook from looping if it is handed a fresh ref
  // each render.
  const report = useCallback((next: DisplaySize) => {
    setSize((current) =>
      current.width === next.width && current.height === next.height ? current : next,
    );
  }, []);

  const update = useMemo(() => debounce(report, debounceMs), [report, debounceMs]);
  const measured = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // The first measurement decides what the first page is rendered at, and the viewer
    // waits for it before asking for anything, so it is not debounced. Every later one
    // is a resize and settles like one — a scale-factor change included, since the OS
    // resizes the window with it and the two must land as one report, not two reloads.
    if (measured.current) {
      update(measure(element, ratio));
    } else {
      measured.current = true;
      report(measure(element, ratio));
    }

    const observer = new ResizeObserver(() => {
      update(measure(element, ratio));
    });
    observer.observe(element);

    // Moving the window to a display with a different scale factor changes the device
    // pixels behind an unchanged CSS box, which no ResizeObserver reports.
    const media = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const onRatioChange = () => {
      setRatio(window.devicePixelRatio || 1);
    };
    media.addEventListener("change", onRatioChange);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onRatioChange);
      update.clear();
    };
  }, [ref, ratio, report, update]);

  return size;
}
