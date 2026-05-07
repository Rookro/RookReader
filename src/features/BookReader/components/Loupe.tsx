import { Box } from "@mui/material";
import { type ReactNode, type RefObject, useEffect, useState } from "react";

/**
 * Props for the Loupe component.
 */
export interface LoupeProps {
  /** The content to be magnified. Typically the images or text being viewed. */
  children: ReactNode;
  /** Whether the loupe magnifier is currently active and visible. */
  isLoupeEnabled: boolean;
  /** The current position of the loupe relative to the container. */
  loupePos: { x: number; y: number };
  /** A React ref pointing to the container element over which the loupe moves. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The magnification factor (zoom level). Defaults to 2. */
  zoom?: number;
  /** The radius of the circular loupe lens in pixels. Defaults to 200. */
  radius?: number;
}

/**
 * A magnifier (loupe) component that temporarily enlarges a portion of its children
 * centered around a specific coordinate. Useful for reading small text or examining details.
 *
 * @param props - The properties for the Loupe component.
 */
export default function Loupe({
  children,
  isLoupeEnabled,
  loupePos,
  containerRef,
  zoom = 2,
  radius = 200,
}: LoupeProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isLoupeEnabled && containerRef.current) {
      setContainerSize({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    }
  }, [isLoupeEnabled, containerRef]);

  useEffect(() => {
    if (!isLoupeEnabled || !containerRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isLoupeEnabled, containerRef]);

  if (!isLoupeEnabled) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "none", // Hide default cursor when loupe is active
      }}
    >
      <Box sx={{ width: "100%", height: "100%" }}>{children}</Box>
      <Box
        sx={{
          position: "absolute",
          pointerEvents: "none",
          left: loupePos.x - radius,
          top: loupePos.y - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(255, 255, 255, 0.5)",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
          zIndex: 1000,
          backgroundColor: "background.default",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            width: containerSize.width,
            height: containerSize.height,
            left: -(loupePos.x - radius),
            top: -(loupePos.y - radius),
            transformOrigin: `${loupePos.x}px ${loupePos.y}px`,
            transform: `scale(${zoom})`,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
