import { describe, expect, it } from "vitest";
import { lensCanvasRect, lensDraws, type Size } from "./lensDraws";

const reader = { width: 1000, height: 800 };
const single = { left: 0, width: 1, align: "center" as const };
const portrait = { width: 400, height: 800 }; // fills the height, x 300..700
const leftSlot = { left: 0, width: 0.5, align: "end" as const };
const rightSlot = { left: 0.5, width: 0.5, align: "start" as const };

describe("lensCanvasRect", () => {
  it("sizes the canvas to the lens, or to the reader when the lens is larger", () => {
    expect(lensCanvasRect(reader, { x: 500, y: 400 }, 100)).toEqual({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    });
    expect(lensCanvasRect(reader, { x: 500, y: 400 }, 5000)).toEqual({
      left: 4500,
      top: 4600,
      width: 1000,
      height: 800,
    });
    // Near the reader's edge the canvas stays inside the lens's square.
    expect(lensCanvasRect(reader, { x: 20, y: 400 }, 100)).toEqual({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    });
    // A lens wider than the reader: the canvas shifts within the square to cover what is visible.
    expect(lensCanvasRect(reader, { x: 20, y: 400 }, 600)).toEqual({
      left: 200,
      top: 200,
      width: 1000,
      height: 800,
    });
  });
});

describe("lensDraws", () => {
  it("draws a page at zoom 1 pixel for pixel", () => {
    const canvas = lensCanvasRect(reader, { x: 500, y: 400 }, 100);
    expect(
      lensDraws(
        [{ slot: single, displayed: portrait, drawn: portrait }],
        reader,
        { x: 500, y: 400 },
        1,
        100,
        canvas,
      ),
    ).toEqual([{ source: 0, sx: 100, sy: 300, sw: 200, sh: 200, dx: 0, dy: 0, dw: 200, dh: 200 }]);
  });

  it("draws the magnified page pixel for pixel at its zoom", () => {
    const canvas = lensCanvasRect(reader, { x: 500, y: 400 }, 100);
    const magnified = { width: 800, height: 1600 };
    expect(
      lensDraws(
        [{ slot: single, displayed: portrait, drawn: magnified }],
        reader,
        { x: 500, y: 400 },
        2,
        100,
        canvas,
      ),
    ).toEqual([{ source: 0, sx: 300, sy: 700, sw: 200, sh: 200, dx: 0, dy: 0, dw: 200, dh: 200 }]);
  });

  it("a_drawn_image_whose_aspect_differs_by_a_pixel_lands_at_the_same_place", () => {
    // The page's left edge (x 300) is inside the lens, at canvas x 100 + (300 - 305) * 10 = 50;
    // placed from a 4001-wide drawn image it would land at 49.5.
    const canvas = lensCanvasRect(reader, { x: 305, y: 400 }, 100);
    const at = (drawn: Size) =>
      lensDraws(
        [{ slot: single, displayed: portrait, drawn }],
        reader,
        { x: 305, y: 400 },
        10,
        100,
        canvas,
      )[0];
    const exact = at({ width: 4000, height: 8000 });
    const rounded = at({ width: 4001, height: 8000 });
    expect([exact.dx, exact.dw]).toEqual([50, 150]);
    expect([rounded.dx, rounded.dy, rounded.dw, rounded.dh]).toEqual([
      exact.dx,
      exact.dy,
      exact.dw,
      exact.dh,
    ]);
  });

  it("names the right page's source when only the right page is under the lens", () => {
    // Pages at x 100..500 and 500..900; the lens (radius 100) at x 700 covers only the right one.
    const canvas = lensCanvasRect(reader, { x: 700, y: 400 }, 100);
    const draws = lensDraws(
      [
        { slot: leftSlot, displayed: portrait, drawn: portrait },
        { slot: rightSlot, displayed: portrait, drawn: portrait },
      ],
      reader,
      { x: 700, y: 400 },
      1,
      100,
      canvas,
    );
    expect(draws).toEqual([
      { source: 1, sx: 100, sy: 300, sw: 200, sh: 200, dx: 0, dy: 0, dw: 200, dh: 200 },
    ]);
  });

  it("draws nothing when the cursor is past the page", () => {
    const canvas = lensCanvasRect(reader, { x: 100, y: 400 }, 100);
    expect(
      lensDraws(
        [{ slot: single, displayed: portrait, drawn: portrait }],
        reader,
        { x: 100, y: 400 },
        2,
        100,
        canvas,
      ),
    ).toEqual([]);
  });

  it("draws both pages of a spread meeting at the spine", () => {
    const canvas = lensCanvasRect(reader, { x: 500, y: 400 }, 100);
    const draws = lensDraws(
      [
        { slot: leftSlot, displayed: portrait, drawn: portrait },
        { slot: rightSlot, displayed: portrait, drawn: portrait },
      ],
      reader,
      { x: 500, y: 400 },
      2,
      100,
      canvas,
    );
    expect(draws).toHaveLength(2);
    expect(draws[0]).toMatchObject({ source: 0, dx: 0, dw: 100 });
    expect(draws[1]).toMatchObject({ source: 1, dx: 100, dw: 100 });
  });

  it("fits a wide page bound by its slot's width", () => {
    const wide = { width: 1600, height: 800 }; // drawn 1000x500 at y 150..650
    const canvas = lensCanvasRect(reader, { x: 500, y: 150 }, 100);
    const [draw] = lensDraws(
      [{ slot: single, displayed: wide, drawn: wide }],
      reader,
      { x: 500, y: 150 },
      1,
      100,
      canvas,
    );
    expect(draw).toEqual({
      source: 0,
      sx: 640,
      sy: 0,
      sw: 320,
      sh: 160,
      dx: 0,
      dy: 100,
      dw: 200,
      dh: 100,
    });
  });

  it("keeps destination inside the canvas and source inside the image at zoom 100", () => {
    const drawn = { width: 4299, height: 6071 };
    const cursor = { x: 699, y: 799 };
    const canvas = lensCanvasRect(reader, cursor, 100);
    const [draw] = lensDraws(
      [{ slot: single, displayed: portrait, drawn }],
      reader,
      cursor,
      100,
      100,
      canvas,
    );
    expect(draw.dx).toBeGreaterThanOrEqual(0);
    expect(draw.dy).toBeGreaterThanOrEqual(0);
    expect(draw.dx + draw.dw).toBeLessThanOrEqual(canvas.width);
    expect(draw.dy + draw.dh).toBeLessThanOrEqual(canvas.height);
    expect(draw.sx).toBeGreaterThanOrEqual(0);
    expect(draw.sy).toBeGreaterThanOrEqual(0);
    expect(draw.sx + draw.sw).toBeLessThanOrEqual(drawn.width);
    expect(draw.sy + draw.sh).toBeLessThanOrEqual(drawn.height);
  });

  it("places the page at its reader coordinates when radius 5000 spans the reader", () => {
    const canvas = lensCanvasRect(reader, { x: 500, y: 400 }, 5000);
    const [draw] = lensDraws(
      [{ slot: single, displayed: portrait, drawn: portrait }],
      reader,
      { x: 500, y: 400 },
      1,
      5000,
      canvas,
    );
    expect(draw).toEqual({
      source: 0,
      sx: 0,
      sy: 0,
      sw: 400,
      sh: 800,
      dx: 300,
      dy: 0,
      dw: 400,
      dh: 800,
    });
  });
});
