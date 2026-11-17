import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { Backdrop, Paper, Typography } from "@mui/material";

/** Props for {@link DropOverlay}. */
export interface DropOverlayProps {
  /** Whether something is being dragged over the window towards this target. */
  open: boolean;
  /** What dropping will do. */
  message: string;
}

/** Covers the window while files are dragged over it, saying what a drop will do. */
export default function DropOverlay({ open, message }: DropOverlayProps) {
  if (!open) {
    return null;
  }
  return (
    <Backdrop open sx={(theme) => ({ zIndex: theme.zIndex.modal + 1, pointerEvents: "none" })}>
      <Paper
        variant="outlined"
        sx={{
          padding: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: "primary.main",
        }}
      >
        <FileDownloadOutlined fontSize="large" color="primary" />
        <Typography variant="h6">{message}</Typography>
      </Paper>
    </Backdrop>
  );
}
