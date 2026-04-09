import { Badge, Box } from "@mui/material";
import { useNovelReader } from "../hooks/useNovelReader";

/** Props for the NovelReader component */
export interface NovelReaderProps {
  /** Path to the local EPUB file */
  filePath: string;
}

/**
 * Component for rendering Novel EPUB files.
 *
 * @beta
 *
 * @remarks
 * This component is currently in beta and may be subject to breaking changes
 * in future releases.
 */
export default function NovelReader({ filePath }: NovelReaderProps) {
  const { viewerRef } = useNovelReader({ filePath });

  return (
    <Badge
      badgeContent="Beta"
      color="primary"
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      sx={{
        width: "100%",
        height: "100%",
        "& .MuiBadge-badge": {
          bottom: 12,
          right: 20,
        },
      }}
    >
      <Box component="div" ref={viewerRef} sx={{ width: "100%", height: "100%" }} />
    </Badge>
  );
}
