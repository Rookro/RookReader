import { Box } from "@mui/material";
import { type ReactNode, useCallback, useLayoutEffect, useRef } from "react";
import type { LensControl } from "../hooks/useLoupe";
import { type LensSource, lensCanvasRect, lensDraws } from "../utils/lensDraws";
import type { PageSlot } from "../utils/pageSlots";

/** One page for the lens. */
export interface LensPage {
  /** The slot describing where the page sits in the reader. */
  slot: PageSlot;
  /** The `<img>` on screen; drawn until `magnified` is ready, and always the page's place. */
  displayed: () => HTMLImageElement | undefined;
  /** The decoded higher-resolution image fetched for the current zoom, when ready. */
  magnified?: HTMLImageElement;
}

/**
 * Props for the Loupe component.
 */
export interface LoupeProps {
  /** The content displayed behind the lens. */
  children: ReactNode;
  /** Whether the loupe magnifier is currently active and visible. */
  isLoupeEnabled: boolean;
  /** Imperative cursor, size, and draw hooks from {@link useLoupe}. */
  lens: LensControl;
  /** The pages currently on screen that the lens can draw. */
  pages: readonly LensPage[];
  /** The magnification factor (zoom level). */
  zoom: number;
  /** The radius of the circular loupe lens in pixels. */
  radius: number;
}

/**
 * A circular magnifier (loupe) that draws the magnified region under the pointer onto a
 * single canvas once per animation frame without re-rendering React on pointer moves.
 *
 * @param props - The properties for the Loupe component.
 */
export default function Loupe({ children, isLoupeEnabled, lens, pages, zoom, radius }: LoupeProps) {
  const lensRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestRef = useRef({ lens, pages, zoom, radius });

  const draw = useCallback(() => {
    const lensElement = lensRef.current;
    const canvas = canvasRef.current;
    if (!lensElement || !canvas) return;

    const {
      lens: currentLens,
      pages: currentPages,
      zoom: currentZoom,
      radius: currentRadius,
    } = latestRef.current;
    const reader = currentLens.readerSizeRef.current;
    if (reader.width <= 0 || reader.height <= 0) return;

    const cursor = currentLens.positionRef.current;
    lensElement.style.transform = `translate3d(${cursor.x - currentRadius}px, ${cursor.y - currentRadius}px, 0px)`;

    const rect = lensCanvasRect(reader, cursor, currentRadius);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.transform = `translate(${rect.left}px, ${rect.top}px)`;

    const dpr = window.devicePixelRatio || 1;
    const backingWidth = Math.max(1, Math.round(rect.width * dpr));
    const backingHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, rect.width, rect.height);

    const sources: LensSource[] = [];
    const images: HTMLImageElement[] = [];
    for (const page of currentPages) {
      const shown = page.displayed();
      if (!shown?.complete || shown.naturalWidth <= 0 || shown.naturalHeight <= 0) {
        continue;
      }
      const image = page.magnified ?? shown;
      sources.push({
        slot: page.slot,
        displayed: { width: shown.naturalWidth, height: shown.naturalHeight },
        drawn: { width: image.naturalWidth, height: image.naturalHeight },
      });
      images.push(image);
    }

    const commands = lensDraws(sources, reader, cursor, currentZoom, currentRadius, rect);
    for (const command of commands) {
      ctx.drawImage(
        images[command.source],
        command.sx,
        command.sy,
        command.sw,
        command.sh,
        command.dx,
        command.dy,
        command.dw,
        command.dh,
      );
    }
  }, []);

  useLayoutEffect(() => {
    latestRef.current = { lens, pages, zoom, radius };
    if (!isLoupeEnabled) {
      lens.drawRef.current = null;
      return;
    }
    lens.drawRef.current = draw;
    lens.drawNow();
    return () => {
      if (lens.drawRef.current === draw) {
        lens.drawRef.current = null;
      }
    };
  }, [isLoupeEnabled, lens, pages, zoom, radius, draw]);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: isLoupeEnabled ? "none" : undefined,
      }}
    >
      {children}
      {isLoupeEnabled && (
        <Box
          ref={lensRef}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
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
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              display: "block",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
