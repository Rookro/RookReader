import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerPosition } from "../input/types";
import type { Point, Size } from "../utils/lensDraws";

/** What `Loupe` needs from `useLoupe` to place and draw the lens. */
export interface LensControl {
  /** The cursor in the reader, in CSS px. Read when drawing; never state. */
  positionRef: RefObject<Point>;
  /**
   * The reader's size in CSS px, fractional; 0x0 until measured. A ref, so a resize
   * draws with the new size at once.
   */
  readerSizeRef: RefObject<Size>;
  /** Set by `Loupe` while the lens is mounted: places the lens and draws the canvas. */
  drawRef: RefObject<(() => void) | null>;
  /** Cancels a pending frame and draws now. */
  drawNow: () => void;
}

/**
 * The comic reader's loupe: whether it is on, its container, and the imperative control
 * the lens draws from without triggering React re-renders on pointer moves.
 *
 * @param containerPath - The open book; the loupe closes when it changes.
 * @returns The loupe's state, container ref, handlers, and lens control.
 */
export function useLoupe(containerPath: string | undefined): {
  isLoupeEnabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  handleMouseMove: (e: React.MouseEvent) => void;
  toggleLoupe: (at?: PointerPosition) => void;
  lens: LensControl;
} {
  const [isLoupeEnabled, setIsLoupeEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(false);
  const positionRef = useRef<Point>({ x: 0, y: 0 });
  const rectRef = useRef({ left: 0, top: 0 });
  const readerSizeRef = useRef<Size>({ width: 0, height: 0 });
  const frameRef = useRef<number | null>(null);
  const drawRef = useRef<(() => void) | null>(null);

  const cancelPendingFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const measure = useCallback((): boolean => {
    const element = containerRef.current;
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    rectRef.current = { left: rect.left, top: rect.top };
    const prev = readerSizeRef.current;
    if (prev.width === rect.width && prev.height === rect.height) {
      return false;
    }
    readerSizeRef.current = { width: rect.width, height: rect.height };
    return true;
  }, []);

  const drawNow = useCallback(() => {
    cancelPendingFrame();
    drawRef.current?.();
  }, [cancelPendingFrame]);

  // A loupe switched on by a mouse button appears under the cursor before the mouse moves.
  const toggleLoupe = useCallback(
    (at?: PointerPosition) => {
      const next = !enabledRef.current;
      enabledRef.current = next;
      if (next) {
        measure();
        if (at) {
          positionRef.current = {
            x: at.clientX - rectRef.current.left,
            y: at.clientY - rectRef.current.top,
          };
        }
      }
      setIsLoupeEnabled(next);
    },
    [measure],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!enabledRef.current) return;
    positionRef.current = {
      x: e.clientX - rectRef.current.left,
      y: e.clientY - rectRef.current.top,
    };
    if (!drawRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      drawRef.current?.();
    });
  }, []);

  useEffect(() => {
    if (!isLoupeEnabled) {
      cancelPendingFrame();
      return;
    }
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (measure()) {
        drawNow();
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [isLoupeEnabled, measure, drawNow, cancelPendingFrame]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the open book changes.
  useEffect(() => {
    cancelPendingFrame();
    enabledRef.current = false;
    positionRef.current = { x: 0, y: 0 };
    setIsLoupeEnabled(false);
  }, [containerPath, cancelPendingFrame]);

  useEffect(() => cancelPendingFrame, [cancelPendingFrame]);

  const lens = useMemo<LensControl>(
    () => ({ positionRef, readerSizeRef, drawRef, drawNow }),
    [drawNow],
  );

  return {
    isLoupeEnabled,
    containerRef,
    handleMouseMove,
    toggleLoupe,
    lens,
  };
}
