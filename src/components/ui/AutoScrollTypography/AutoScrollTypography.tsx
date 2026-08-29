import { Box, Typography, type TypographyProps } from "@mui/material";
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

const containerSx = {
  width: "100%",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
} as const;

// `will-change` asks the compositor to keep the text on its own layer. Without
// it WebKitGTK re-rasterises every glyph on each frame instead of just moving
// an existing layer, which dominates the cost on a shelf full of long titles.
const animatingSx = {
  whiteSpace: "nowrap",
  display: "inline-block",
  willChange: "transform",
} as const;

const clampedSx = {
  whiteSpace: "nowrap",
  display: "block",
  textOverflow: "ellipsis",
  overflow: "hidden",
} as const;

/**
 * A component that displays text and automatically scrolls it horizontally
 * if the text content overflows its container.
 *
 * The scroll itself is driven by the Web Animations API from
 * {@link useAutoScrollAnimation}. Respects 'prefers-reduced-motion' by
 * disabling animation.
 */
const AutoScrollTypography = memo(function AutoScrollTypography({
  text,
  enabled = true,
  pixelsPerSecond = 20,
  delaySeconds = 3,
  sx,
  ...props
}: AutoScrollTypographyProps) {
  const { containerRef, contentRef, scrollRef, shouldAnimate } = useAutoScrollAnimation(
    enabled,
    pixelsPerSecond,
    delaySeconds,
  );

  return (
    <Box ref={containerRef} sx={containerSx}>
      <Typography
        component="div"
        ref={scrollRef}
        data-animating={shouldAnimate}
        sx={[shouldAnimate ? animatingSx : clampedSx, ...(Array.isArray(sx) ? sx : [sx])]}
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
