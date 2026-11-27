import { Box } from "@mui/material";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useLoupe } from "../hooks/useLoupe";
import type { PointerPosition } from "../input/types";
import { installLensStubs, type LensStubs } from "../test/lensStubs";
import type { PageSlot, SlotRole } from "../utils/pageSlots";
import Loupe, { type LensPage } from "./Loupe";

const SINGLE_SLOT: PageSlot = {
  role: "single",
  left: 0,
  width: 1,
  align: "center",
  url: "blob:page-1",
  entry: "p1.jpg",
};

const DEFAULT_SLOTS: readonly PageSlot[] = [SINGLE_SLOT];

const SPREAD_SLOTS: PageSlot[] = [
  { role: "left", left: 0, width: 0.5, align: "end", url: "blob:left", entry: "p1.jpg" },
  { role: "right", left: 0.5, width: 0.5, align: "start", url: "blob:right", entry: "p2.jpg" },
];

interface HarnessProps {
  book?: string;
  slots?: readonly PageSlot[];
  magnified?: ReadonlyMap<string, HTMLImageElement>;
  zoom?: number;
  radius?: number;
  hasLayout?: boolean;
  onRender: () => void;
  onControls: (controls: { toggleLoupe: (at?: PointerPosition) => void }) => void;
}

const Harness = ({
  book = "book-a",
  slots = DEFAULT_SLOTS,
  magnified,
  zoom = 2,
  radius = 100,
  hasLayout = true,
  onRender,
  onControls,
}: HarnessProps) => {
  onRender();
  const { isLoupeEnabled, containerRef, handleMouseMove, toggleLoupe, lens } = useLoupe(book);
  onControls({ toggleLoupe });
  const imageRefs = useRef(new Map<SlotRole, HTMLImageElement>());

  const pages: LensPage[] = useMemo(
    () =>
      slots.map((slot) => ({
        slot,
        displayed: () => imageRefs.current.get(slot.role),
        magnified: slot.entry ? magnified?.get(slot.entry) : undefined,
      })),
    [slots, magnified],
  );

  const content = (
    <div>
      {slots.map((slot) => (
        <img
          key={slot.role}
          alt={`page-${slot.role}`}
          src={slot.url}
          onLoad={lens.drawNow}
          ref={(el) => {
            if (el) imageRefs.current.set(slot.role, el);
            else imageRefs.current.delete(slot.role);
          }}
        />
      ))}
    </div>
  );

  return (
    <Box ref={containerRef} data-testid="reader" onMouseMove={handleMouseMove}>
      {hasLayout && (
        <Loupe
          isLoupeEnabled={isLoupeEnabled}
          lens={lens}
          pages={pages}
          zoom={zoom}
          radius={radius}
        >
          {content}
        </Loupe>
      )}
    </Box>
  );
};

const cssRuleCount = () =>
  [...document.querySelectorAll("style")].reduce(
    (sum, style) => sum + (style.sheet?.cssRules.length ?? 0),
    0,
  );

describe("Loupe", () => {
  let stubs: LensStubs;

  beforeEach(() => {
    stubs = installLensStubs();
  });

  afterEach(() => {
    stubs.restore();
  });

  const mountHarness = (initial: Partial<Omit<HarnessProps, "onRender" | "onControls">> = {}) => {
    let renders = 0;
    let controls: { toggleLoupe: (at?: PointerPosition) => void } = {
      toggleLoupe: () => {},
    };
    const renderProps = (
      overrides: Partial<Omit<HarnessProps, "onRender" | "onControls">> = {},
    ) => (
      <Harness
        {...initial}
        {...overrides}
        onRender={() => {
          renders += 1;
        }}
        onControls={(c) => {
          controls = c;
        }}
      />
    );
    const view = render(renderProps());
    const reader = screen.getByTestId("reader");
    const { rect, spy: rectSpy } = stubs.mockReaderRect(reader);
    return {
      view,
      reader,
      rect,
      rectSpy,
      getRenders: () => renders,
      toggleLoupe: (at?: PointerPosition) => {
        act(() => {
          controls.toggleLoupe(at);
        });
      },
      rerenderWith: (overrides: Partial<Omit<HarnessProps, "onRender" | "onControls">>) => {
        view.rerender(renderProps(overrides));
      },
    };
  };

  const getCanvasAndLens = (container: HTMLElement) => {
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    const lens = canvas?.parentElement as HTMLElement;
    expect(lens).not.toBeNull();
    return { canvas: canvas as HTMLCanvasElement, lens };
  };

  it("moves without rendering, measuring or adding CSS", () => {
    const { reader, rectSpy, getRenders, toggleLoupe } = mountHarness({ radius: 100 });
    toggleLoupe({ clientX: 600, clientY: 450 });
    stubs.flushFrame();

    const rendersBefore = getRenders();
    const rectCallsBefore = rectSpy.mock.calls.length;
    const cssRulesBefore = cssRuleCount();

    // Unique coordinates unused by any other test so Emotion's persistent cache would grow
    // if lens movement were routed through `sx`.
    for (let i = 0; i < 20; i++) {
      fireEvent.mouseMove(reader, { clientX: 113 + i * 17, clientY: 71 + i * 19 });
    }
    act(() => {
      stubs.flushFrame();
    });

    expect(getRenders()).toBe(rendersBefore);
    expect(rectSpy.mock.calls.length).toBe(rectCallsBefore);
    expect(cssRuleCount()).toBe(cssRulesBefore);
  });

  it("draws once per frame", () => {
    const { view, reader, toggleLoupe } = mountHarness({ radius: 100 });
    toggleLoupe({ clientX: 600, clientY: 450 });
    stubs.ctx.drawImage.mockClear();

    fireEvent.mouseMove(reader, { clientX: 300, clientY: 250 });
    fireEvent.mouseMove(reader, { clientX: 400, clientY: 350 });
    fireEvent.mouseMove(reader, { clientX: 520, clientY: 410 });
    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();

    stubs.flushFrame();

    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
    const { lens } = getCanvasAndLens(view.container);
    // Reader is at (100, 50), so client (520, 410) is reader (420, 360), minus radius 100.
    expect(lens.style.transform).toBe("translate3d(320px, 260px, 0px)");
  });

  it("keeps the pages' images mounted", () => {
    const { toggleLoupe } = mountHarness();
    const initialImg = screen.getByAltText("page-single");

    toggleLoupe({ clientX: 600, clientY: 450 });
    expect(screen.getByAltText("page-single")).toBe(initialImg);

    toggleLoupe();
    expect(screen.getByAltText("page-single")).toBe(initialImg);

    toggleLoupe({ clientX: 600, clientY: 450 });
    expect(screen.getByAltText("page-single")).toBe(initialImg);
  });

  it("opens under the mouse button before any move", () => {
    const { view, toggleLoupe } = mountHarness({ radius: 100 });

    toggleLoupe({ clientX: 600, clientY: 450 });

    const { lens } = getCanvasAndLens(view.container);
    expect(lens.style.transform).toBe("translate3d(400px, 300px, 0px)");
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("opens from the keyboard at the last position", () => {
    const { view, reader, toggleLoupe } = mountHarness({ radius: 100 });
    toggleLoupe({ clientX: 600, clientY: 450 });
    fireEvent.mouseMove(reader, { clientX: 700, clientY: 500 });
    stubs.flushFrame();
    toggleLoupe();
    stubs.ctx.drawImage.mockClear();

    toggleLoupe();

    const { lens } = getCanvasAndLens(view.container);
    expect(lens.style.transform).toBe("translate3d(500px, 350px, 0px)");
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending frame on close, on a book change and on unmount", () => {
    // 1. Close
    const first = mountHarness();
    first.toggleLoupe({ clientX: 600, clientY: 450 });
    stubs.ctx.drawImage.mockClear();
    stubs.cancelRafSpy.mockClear();
    fireEvent.mouseMove(first.reader, { clientX: 620, clientY: 460 });
    const closeId = stubs.pendingFrameIds()[0];
    first.toggleLoupe();
    expect(stubs.cancelRafSpy).toHaveBeenCalledWith(closeId);
    stubs.flushFrame();
    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();
    first.view.unmount();

    // 2. Book change
    const second = mountHarness({ book: "book-a" });
    second.toggleLoupe({ clientX: 600, clientY: 450 });
    stubs.ctx.drawImage.mockClear();
    stubs.cancelRafSpy.mockClear();
    fireEvent.mouseMove(second.reader, { clientX: 620, clientY: 460 });
    const bookId = stubs.pendingFrameIds()[0];
    second.rerenderWith({ book: "book-b" });
    expect(stubs.cancelRafSpy).toHaveBeenCalledWith(bookId);
    stubs.flushFrame();
    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();
    second.view.unmount();

    // 3. Unmount
    const third = mountHarness();
    third.toggleLoupe({ clientX: 600, clientY: 450 });
    stubs.ctx.drawImage.mockClear();
    stubs.cancelRafSpy.mockClear();
    fireEvent.mouseMove(third.reader, { clientX: 620, clientY: 460 });
    const unmountId = stubs.pendingFrameIds()[0];
    third.view.unmount();
    expect(stubs.cancelRafSpy).toHaveBeenCalledWith(unmountId);
    stubs.flushFrame();
    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();
  });

  it("redraws when the reader resizes and ignores a 0x0 report", () => {
    const { view, rect, toggleLoupe } = mountHarness({ radius: 500 });
    toggleLoupe({ clientX: 600, clientY: 450 });
    stubs.ctx.drawImage.mockClear();

    rect.width = 800;
    rect.height = 600;
    stubs.triggerResize();

    const { canvas } = getCanvasAndLens(view.container);
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(canvas.style.width).toBe("800px");
    expect(canvas.style.height).toBe("600px");

    stubs.ctx.drawImage.mockClear();
    rect.width = 0;
    rect.height = 0;
    stubs.triggerResize();

    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();
    expect(canvas.style.width).toBe("800px");
    expect(canvas.style.height).toBe("600px");
  });

  it("redraws when the zoom, the radius or the pages change, and when a magnified page is ready", () => {
    const { toggleLoupe, rerenderWith } = mountHarness({ zoom: 2, radius: 100 });
    toggleLoupe({ clientX: 600, clientY: 450 });

    stubs.ctx.drawImage.mockClear();
    rerenderWith({ zoom: 4 });
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);

    stubs.ctx.drawImage.mockClear();
    rerenderWith({ zoom: 4, radius: 150 });
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);

    stubs.ctx.drawImage.mockClear();
    rerenderWith({
      zoom: 4,
      radius: 150,
      slots: [{ ...SINGLE_SLOT, url: "blob:page-2", entry: "p2.jpg" }],
    });
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);

    stubs.ctx.drawImage.mockClear();
    const magnified = document.createElement("img");
    rerenderWith({
      zoom: 4,
      radius: 150,
      slots: [{ ...SINGLE_SLOT, url: "blob:page-2", entry: "p2.jpg" }],
      magnified: new Map([["p2.jpg", magnified]]),
    });
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("draws the displayed page until the magnified one is ready", () => {
    const { toggleLoupe, rerenderWith } = mountHarness();
    const displayed = screen.getByAltText("page-single");
    toggleLoupe({ clientX: 600, clientY: 450 });

    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(stubs.ctx.drawImage.mock.calls[0][0]).toBe(displayed);

    stubs.ctx.drawImage.mockClear();
    const magnified = document.createElement("img");
    rerenderWith({ magnified: new Map([["p1.jpg", magnified]]) });

    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(stubs.ctx.drawImage.mock.calls[0][0]).toBe(magnified);
  });

  it("sizes the backing store by the device pixel ratio with smoothing high", () => {
    const { view, toggleLoupe } = mountHarness({ radius: 100 });
    toggleLoupe({ clientX: 600, clientY: 450 });

    const { canvas } = getCanvasAndLens(view.container);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
    expect(stubs.ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(stubs.ctx.imageSmoothingEnabled).toBe(true);
    expect(stubs.ctx.imageSmoothingQuality).toBe("high");
  });

  it("keeps the canvas within the reader at the largest radius", () => {
    const { view, toggleLoupe } = mountHarness({ radius: 5000 });
    toggleLoupe({ clientX: 600, clientY: 450 });

    const { canvas } = getCanvasAndLens(view.container);
    expect(canvas.style.width).toBe("1000px");
    expect(canvas.style.height).toBe("800px");
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1600);
  });

  it("draws the right page's image when only the right page is under the lens", () => {
    const { toggleLoupe } = mountHarness({ slots: SPREAD_SLOTS, zoom: 2, radius: 100 });
    const rightImg = screen.getByAltText("page-right");

    // Reader is 1000x800 at (100, 50). Each 400x800 page occupies 400px next to the centre
    // seam: left is [100, 500], right is [500, 900]. At cursor (750, 400) with radius 100
    // and zoom 2, the lens spans [700, 800] — only the right page.
    toggleLoupe({ clientX: 850, clientY: 450 });

    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(stubs.ctx.drawImage.mock.calls[0][0]).toBe(rightImg);
  });

  it("draws once a layout arrives with the loupe already on", () => {
    const { view, reader, toggleLoupe, rerenderWith } = mountHarness({
      hasLayout: false,
      radius: 100,
    });

    toggleLoupe({ clientX: 600, clientY: 450 });
    fireEvent.mouseMove(reader, { clientX: 700, clientY: 500 });
    stubs.flushFrame();
    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();

    rerenderWith({ hasLayout: true });

    const { lens } = getCanvasAndLens(view.container);
    expect(lens.style.transform).toBe("translate3d(500px, 350px, 0px)");
    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("draws the displayed page when the image finishes loading after the layout commit", () => {
    const { toggleLoupe } = mountHarness();
    const img = screen.getByAltText("page-single") as HTMLImageElement;
    Object.defineProperty(img, "complete", { configurable: true, value: false });
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: 0 });

    toggleLoupe({ clientX: 600, clientY: 450 });
    expect(stubs.ctx.drawImage).not.toHaveBeenCalled();

    Object.defineProperty(img, "complete", { configurable: true, value: true });
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: 400 });
    fireEvent.load(img);

    expect(stubs.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(stubs.ctx.drawImage.mock.calls[0][0]).toBe(img);
  });
});
