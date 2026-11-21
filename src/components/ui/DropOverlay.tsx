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
 * Covers its nearest positioned ancestor while files are dragged over the window, saying
 * what a drop will do.
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
          inset: 0,
          // Above the loupe (1000) and the floating controls.
          zIndex: theme.zIndex.appBar,
          pointerEvents: "none",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          padding: 2,
          textAlign: "center",
        }),
        (theme) => ({
          // A veil so the content underneath recedes; it fills the area edge to edge.
          backgroundColor: alpha(theme.palette.background.default, 0.72),
          // The frame sits a little inside the veil, so its rounded corners show no content.
          // It is drawn under the icon and the message, above the veil.
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 4,
            zIndex: -1,
            pointerEvents: "none",
            ...dropTargetActiveSx(theme),
          },
        }),
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
