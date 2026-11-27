import type { PageSlot } from "./pageSlots";

/** A width and height pair. */
export interface Size {
  /** Horizontal extent. */
  width: number;
  /** Vertical extent. */
  height: number;
}

/** A 2D coordinate in CSS pixels. */
export interface Point {
  /** Horizontal coordinate. */
  x: number;
  /** Vertical coordinate. */
  y: number;
}

/** The canvas's place inside the lens's square, in CSS pixels. */
export interface CanvasRect {
  /** Left offset inside the lens square, in CSS pixels. */
  left: number;
  /** Top offset inside the lens square, in CSS pixels. */
  top: number;
  /** Canvas CSS width, never larger than the lens or reader. */
  width: number;
  /** Canvas CSS height, never larger than the lens or reader. */
  height: number;
}

/** One page to draw in the lens, separating its on-screen placement from the drawn image scale. */
export interface LensSource {
  /** Slot placement and alignment within the reader. */
  slot: Pick<PageSlot, "left" | "width" | "align">;
  /** The displayed image's natural size: determines where the page sits on screen. */
  displayed: Size;
  /** The natural size of the image drawn: determines only the source rectangle scale. */
  drawn: Size;
}

/** One `drawImage` call; `source` is the index of the {@link LensSource} (and image) it draws. */
export interface DrawCommand {
  /** Index into the `sources` array passed to {@link lensDraws}. */
  source: number;
  /** Source rectangle left edge in drawn image pixels. */
  sx: number;
  /** Source rectangle top edge in drawn image pixels. */
  sy: number;
  /** Source rectangle width in drawn image pixels. */
  sw: number;
  /** Source rectangle height in drawn image pixels. */
  sh: number;
  /** Destination rectangle left edge in canvas CSS pixels. */
  dx: number;
  /** Destination rectangle top edge in canvas CSS pixels. */
  dy: number;
  /** Destination rectangle width in canvas CSS pixels. */
  dw: number;
  /** Destination rectangle height in canvas CSS pixels. */
  dh: number;
}

/**
 * Computes the canvas's CSS size and offset inside the lens square.
 *
 * Never larger than the reader, never outside the lens's square, and always covering
 * the part of the lens inside the reader.
 *
 * @param reader The reader area's CSS size.
 * @param cursor The cursor position relative to the reader, in CSS pixels.
 * @param radius The lens radius, in CSS pixels.
 * @returns The canvas rectangle inside the lens square.
 */
export const lensCanvasRect = (reader: Size, cursor: Point, radius: number): CanvasRect => {
  const width = Math.min(2 * radius, Math.ceil(reader.width));
  const height = Math.min(2 * radius, Math.ceil(reader.height));
  return {
    left: Math.min(Math.max(0, radius - cursor.x), 2 * radius - width),
    top: Math.min(Math.max(0, radius - cursor.y), 2 * radius - height),
    width,
    height,
  };
};

/**
 * Computes the clipped `drawImage` rectangles for every page visible inside the lens canvas.
 *
 * Each page's on-screen rectangle is `object-fit: contain` of `displayed` inside its slot,
 * so swapping in a magnified image whose aspect differs by a rounding pixel never moves the page.
 *
 * @param sources The drawable pages in the layout.
 * @param reader The reader area's CSS size.
 * @param cursor The cursor position relative to the reader, in CSS pixels.
 * @param zoom The loupe's magnification factor.
 * @param radius The lens radius, in CSS pixels.
 * @param canvas The canvas's rectangle inside the lens square, from {@link lensCanvasRect}.
 * @returns One {@link DrawCommand} per source with a visible part, in source order.
 */
export const lensDraws = (
  sources: readonly LensSource[],
  reader: Size,
  cursor: Point,
  zoom: number,
  radius: number,
  canvas: CanvasRect,
): DrawCommand[] => {
  const draws: DrawCommand[] = [];
  sources.forEach(({ slot, displayed, drawn }, source) => {
    if (displayed.width <= 0 || displayed.height <= 0 || drawn.width <= 0 || drawn.height <= 0) {
      return;
    }
    // Where the screen puts the page: `object-fit: contain` in its slot.
    const slotLeft = slot.left * reader.width;
    const slotWidth = slot.width * reader.width;
    const fit = Math.min(slotWidth / displayed.width, reader.height / displayed.height);
    const pageWidth = displayed.width * fit;
    const pageHeight = displayed.height * fit;
    const slack = slotWidth - pageWidth;
    const pageLeft =
      slotLeft + (slot.align === "start" ? 0 : slot.align === "end" ? slack : slack / 2);
    const pageTop = (reader.height - pageHeight) / 2;

    // A reader point p sits in the lens at radius + (p - cursor) * zoom.
    const x = radius + (pageLeft - cursor.x) * zoom - canvas.left;
    const y = radius + (pageTop - cursor.y) * zoom - canvas.top;
    const w = pageWidth * zoom;
    const h = pageHeight * zoom;
    const left = Math.max(x, 0);
    const top = Math.max(y, 0);
    const right = Math.min(x + w, canvas.width);
    const bottom = Math.min(y + h, canvas.height);
    if (right <= left || bottom <= top) {
      return;
    }

    const kx = drawn.width / w;
    const ky = drawn.height / h;
    const sx = Math.min((left - x) * kx, drawn.width);
    const sy = Math.min((top - y) * ky, drawn.height);
    draws.push({
      source,
      sx,
      sy,
      sw: Math.min((right - left) * kx, drawn.width - sx),
      sh: Math.min((bottom - top) * ky, drawn.height - sy),
      dx: left,
      dy: top,
      dw: right - left,
      dh: bottom - top,
    });
  });
  return draws;
};
