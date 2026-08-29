import { useEffect, useRef, useState } from "react";
import { observeResize } from "../../../utils/SharedResizeObserver";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** Timing of one complete scroll cycle, derived from the measured text width. */
export interface AutoScrollMetrics {
  /** Width of the text in pixels. */
  contentWidth: number;
  /** Duration of one cycle, including the initial pause, in milliseconds. */
  durationMs: number;
  /** Fraction of the cycle (0-1) the text stays still before it starts scrolling. */
  delayFraction: number;
}

/**
 * Measures the text and drives its horizontal scrolling animation.
 *
 * The animation runs through the Web Animations API rather than a CSS
 * `animation` property. Expressing the initial pause as a keyframe percentage
 * means every distinct title width needs its own `@keyframes` rule, and
 * injecting those rules re-runs style resolution across the whole document on
 * WebKitGTK. Keeping the keyframes on the element avoids touching the CSSOM.
 *
 * @param enabled Whether scrolling is allowed at all.
 * @param pixelsPerSecond The number of pixels to scroll per second.
 * @param delaySeconds The number of seconds to wait before starting the scroll.
 * @returns The refs to attach, and whether the text is currently animating.
 */
export function useAutoScrollAnimation(
  enabled: boolean,
  pixelsPerSecond: number,
  delaySeconds: number,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const [metrics, setMetrics] = useState<AutoScrollMetrics | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Measured after paint rather than in a layout effect: reading widths forces a
  // synchronous layout, and doing that during commit for every card scrolling
  // into view is what makes a large bookshelf stutter.
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) return;

    let measured: AutoScrollMetrics | null = null;

    const measure = () => {
      const containerWidth = container.clientWidth;
      const contentWidth = content.offsetWidth;

      let next: AutoScrollMetrics | null = null;
      if (contentWidth > containerWidth) {
        const totalSeconds = contentWidth / pixelsPerSecond + delaySeconds;
        next = {
          contentWidth,
          durationMs: totalSeconds * 1000,
          delayFraction: delaySeconds / totalSeconds,
        };
      }

      // Bail out when the width is unchanged so a resize notification neither
      // re-renders the card nor restarts a running animation.
      if (next?.contentWidth === measured?.contentWidth) return;

      measured = next;
      setMetrics(next);
    };

    measure();

    const unobserveContainer = observeResize(container, measure);
    const unobserveContent = observeResize(content, measure);

    return () => {
      unobserveContainer();
      unobserveContent();
    };
  }, [pixelsPerSecond, delaySeconds]);

  const isOverflowing = metrics !== null;
  const shouldAnimate = enabled && isOverflowing && !prefersReducedMotion;

  useEffect(() => {
    const element = scrollRef.current;

    if (!element || !shouldAnimate || !metrics) return;
    // jsdom has no Web Animations API.
    if (typeof element.animate !== "function") return;

    const animation = element.animate(
      [
        { transform: "translateX(0)", offset: 0 },
        ...(metrics.delayFraction > 0
          ? [{ transform: "translateX(0)", offset: metrics.delayFraction }]
          : []),
        { transform: `translateX(-${metrics.contentWidth}px)`, offset: 1 },
      ],
      {
        duration: metrics.durationMs,
        iterations: Number.POSITIVE_INFINITY,
        easing: "linear",
      },
    );

    return () => animation.cancel();
  }, [shouldAnimate, metrics]);

  return { containerRef, contentRef, scrollRef, isOverflowing, shouldAnimate, metrics };
}
