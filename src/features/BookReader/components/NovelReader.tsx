import { Badge, Box } from "@mui/material";
import React, { forwardRef } from "react";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { useNovelReader } from "../hooks/useNovelReader";

/**
 * Type-safe wrapper for the custom element 'foliate-view'.
 * This approach uses forwardRef and createElement to avoid 'as unknown as'
 * or global module augmentation.
 */
const FoliateView = forwardRef<
  import("foliate-js/view.js").View,
  React.HTMLAttributes<HTMLElement> & { class?: string }
>((props, ref) => React.createElement("foliate-view", { ...props, ref }));

/** Props for the NovelReader component */
interface NovelReaderProps {
  /** Path to the local EPUB file */
  filePath: string;
}

/**
 * Component for rendering Novel EPUB files using foliate-js.
 *
 * @beta
 */
export default function NovelReader({ filePath }: NovelReaderProps) {
  const theme = useAppTheme();
  const { viewRef } = useNovelReader(filePath);

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
      <Box sx={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <FoliateView
          key={filePath}
          ref={viewRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            background: theme.palette.background.default,
          }}
        />
      </Box>
    </Badge>
  );
}
