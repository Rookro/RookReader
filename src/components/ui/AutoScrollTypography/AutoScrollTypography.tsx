import { Box, Typography, type TypographyProps, useMediaQuery } from "@mui/material";
import { memo } from "react";
import { useAutoScrollAnimation } from "./useAutoScrollAnimation";

/** Props for the AutoScrollTypography component.*/
interface AutoScrollTypographyProps extends TypographyProps {
  /** The text content to display.*/
  text: string;
  /**
   * Whether the scrolling animation is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * The speed of the scrolling animation in pixels per second.
   * @default 20
   */
  pixelsPerSecond?: number;
  /**
   * The delay in seconds before the scrolling animation starts (and between loops).
   * @default 3
   */
  delaySeconds?: number;
}

/**
 * A component that displays text and automatically scrolls it horizontally
 * if the text content overflows its container.
 *
 * Uses CSS animations calculated based on the text width and container width.
 * Respects 'prefers-reduced-motion' by disabling animation.
 */
const AutoScrollTypography = memo(function AutoScrollTypography({
  text,
  enabled = true,
  pixelsPerSecond = 20,
  delaySeconds = 3,
  sx,
  ...props
}: AutoScrollTypographyProps) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { containerRef, contentRef, isOverflowing, animationStyle, delayPercent } =
    useAutoScrollAnimation(pixelsPerSecond, delaySeconds);

  // If user prefers reduced motion, force non-scrolling behavior
  const shouldAnimate = enabled && isOverflowing && !prefersReducedMotion;
  const keyframeName = `auto-scroll-text-${delayPercent.toFixed(2).replace(".", "-")}`;

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Typography
        component="div"
        data-animating={shouldAnimate}
        sx={{
          whiteSpace: "nowrap",
          ...(shouldAnimate
            ? {
                display: "inline-block",
                animation: `${keyframeName} var(--scroll-duration) linear infinite`,
                [`@keyframes ${keyframeName}`]: {
                  [`0%, ${delayPercent}%`]: { transform: "translateX(0)" },
                  "100%": { transform: "translateX(var(--scroll-offset))" },
                },
                ...animationStyle,
              }
            : {
                display: "block",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }),
          ...sx,
        }}
        {...props}
      >
        <Box component="span" ref={contentRef}>
          {text}
        </Box>
      </Typography>
    </Box>
  );
});

export default AutoScrollTypography;
