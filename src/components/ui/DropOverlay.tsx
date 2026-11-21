import type { SvgIconComponent } from "@mui/icons-material";
import { alpha, Stack, type SxProps, type Theme, Typography } from "@mui/material";

/** Marks the area that receives a drop while files are dragged over it. */
export const dropTargetActiveSx = ((theme: Theme) => ({
  border: `2px solid ${theme.palette.primary.main}`,
  borderRadius: 2,
  backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.primary.main, 0.1)})`,
})) satisfies SxProps<Theme>;

/** Props for {@link DropOverlay}. */
export interface DropOverlayProps {
  /** Whether something is being dragged over the window towards this target. */
  open: boolean;
  /** What dropping will do. */
  message: string;
  /** Icon shown above the message. */
  icon: SvgIconComponent;
  /** Styles merged last, for example to override the position. */
  sx?: SxProps<Theme>;
}

/**
 * Covers its parent while files are dragged over the window, saying what a drop will do.
 *
 * The parent must be positioned, since the overlay is placed absolutely against it.
 */
export default function DropOverlay({ open, message, icon: Icon, sx }: DropOverlayProps) {
  if (!open) {
    return null;
  }
  return (
    <Stack
      sx={[
        (theme) => ({
          position: "absolute",
          inset: 8,
          // Above the loupe (1000) and the floating controls.
          zIndex: theme.zIndex.appBar,
          pointerEvents: "none",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          padding: 2,
          textAlign: "center",
        }),
        dropTargetActiveSx,
        // A veil so the content underneath recedes.
        (theme) => ({ backgroundColor: alpha(theme.palette.background.default, 0.72) }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Icon sx={{ fontSize: 48, color: "primary.main" }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
        {message}
      </Typography>
    </Stack>
  );
}
