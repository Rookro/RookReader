import { useRef, useState, useLayoutEffect } from "react";

/**
 * Custom hook to calculate animation parameters based on content and container width for auto-scrolling text.
 * @param text The text content to scroll.
 * @param pixelsPerSecond The number of pixels to scroll per second.
 * @param delaySeconds The number of seconds to delay before starting the scroll.
 * @returns An object with the container and content refs, overflow state, and animation style.
 */
export function useAutoScrollAnimation(
  text: string,
  pixelsPerSecond: number,
  delaySeconds: number,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [animationStyle, setAnimationStyle] = useState<object>({});

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
        const delayPercent = (delaySeconds / totalSeconds) * 100;

        setAnimationStyle({
          animation: `auto-scroll-text ${totalSeconds}s linear infinite`,
          "@keyframes auto-scroll-text": {
            [`0%, ${delayPercent}%`]: { transform: "translateX(0)" },
            "100%": { transform: "translateX(-100%)" },
          },
        });
      } else {
        setIsOverflowing(false);
        setAnimationStyle({});
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
  }, [text, pixelsPerSecond, delaySeconds]);

  return { containerRef, contentRef, isOverflowing, animationStyle };
}
