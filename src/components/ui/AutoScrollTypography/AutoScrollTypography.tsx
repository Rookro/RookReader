import { Box, Typography, type TypographyProps, useMediaQuery } from "@mui/material";
import { useAutoScrollAnimation } from "./useAutoScrollAnimation";

/** Props for the AutoScrollTypography component.*/
interface AutoScrollTypographyProps extends TypographyProps {
  /** The text content to display.*/
  text: string;
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
export default function AutoScrollTypography({
  text,
  pixelsPerSecond = 20,
  delaySeconds = 3,
  sx,
  ...props
}: AutoScrollTypographyProps) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { containerRef, contentRef, isOverflowing, animationStyle } = useAutoScrollAnimation(
    pixelsPerSecond,
    delaySeconds,
  );

  // If user prefers reduced motion, force non-scrolling behavior
  const shouldAnimate = isOverflowing && !prefersReducedMotion;

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
}
