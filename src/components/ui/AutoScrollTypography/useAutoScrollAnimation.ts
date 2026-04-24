import { useLayoutEffect, useRef, useState } from "react";

/**
 * Custom hook to calculate animation parameters based on content and container width for auto-scrolling text.
 * @param pixelsPerSecond The number of pixels to scroll per second.
 * @param delaySeconds The number of seconds to delay before starting the scroll.
 * @returns An object with the container and content refs, overflow state, and animation style.
 */
export function useAutoScrollAnimation(pixelsPerSecond: number, delaySeconds: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [animationStyle, setAnimationStyle] = useState<object>({});
  const [delayPercent, setDelayPercent] = useState<number>(0);

  // Use ResizeObserver to detect size changes of the container
  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) return;

    const calculateOverflow = () => {
      const containerWidth = container.clientWidth;
      const contentWidth = content.offsetWidth;

      if (contentWidth > containerWidth) {
        setIsOverflowing(true);

        const scrollSeconds = contentWidth / pixelsPerSecond;
        const totalSeconds = scrollSeconds + delaySeconds;
        const calcDelayPercent = (delaySeconds / totalSeconds) * 100;

        setDelayPercent(calcDelayPercent);
        setAnimationStyle({
          "--scroll-duration": `${totalSeconds}s`,
          "--scroll-offset": `-${contentWidth}px`,
        } as React.CSSProperties);
      } else {
        setIsOverflowing(false);
        setAnimationStyle({});
        setDelayPercent(0);
      }
    };

    // Initial calculation
    calculateOverflow();

    // Observe container resize
    const resizeObserver = new ResizeObserver(() => {
      calculateOverflow();
    });

    resizeObserver.observe(container);
    // Also observe content if text changes size dynamically (though text dep handles this mostly)
    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  }, [pixelsPerSecond, delaySeconds]);

  return { containerRef, contentRef, isOverflowing, animationStyle, delayPercent };
}
