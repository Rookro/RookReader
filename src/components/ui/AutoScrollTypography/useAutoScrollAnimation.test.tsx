import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScrollAnimation } from "./useAutoScrollAnimation";

/** A ResizeObserver stand-in that remembers its targets so tests can fire it. */
class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  readonly observed = new Set<Element>();
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }

  /** Notifies every observed target, the way a real resize would. */
  fire() {
    const entries = [...this.observed].map(
      (target) => ({ target }) as unknown as ResizeObserverEntry,
    );
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

/**
 * The shared observer outlives individual tests, so it is built once for the
 * whole file rather than per test.
 */
function sharedObserver(): ResizeObserverMock {
  const observer = ResizeObserverMock.instances.at(-1);
  if (!observer) throw new Error("no ResizeObserver was created");
  return observer;
}

function TestComponent({
  text,
  enabled = true,
  pixelsPerSecond = 50,
  delaySeconds = 2,
}: {
  text: string;
  enabled?: boolean;
  pixelsPerSecond?: number;
  delaySeconds?: number;
}) {
  const { containerRef, contentRef, scrollRef, isOverflowing, shouldAnimate } =
    useAutoScrollAnimation(enabled, pixelsPerSecond, delaySeconds);

  return (
    <div ref={containerRef} data-testid="container">
      <div ref={scrollRef} data-testid="scroll">
        <span ref={contentRef} data-testid="content">
          {text}
        </span>
      </div>
      <span data-testid="overflow">{String(isOverflowing)}</span>
      <span data-testid="animating">{String(shouldAnimate)}</span>
    </div>
  );
}

describe("useAutoScrollAnimation", () => {
  let cancel: ReturnType<typeof vi.fn>;
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    // jsdom has no Web Animations API, so provide one to assert against.
    cancel = vi.fn();
    animate = vi.fn(() => ({ cancel }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    HTMLElement.prototype.animate = undefined as unknown as HTMLElement["animate"];
  });

  it("should detect overflow and animate with the calculated timing", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);

    render(<TestComponent text="very long text" />);

    expect(screen.getByTestId("overflow").textContent).toBe("true");
    expect(screen.getByTestId("animating").textContent).toBe("true");

    // 200px / 50px per second + 2s of delay = a 6s cycle, one third of it paused.
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0] ?? [];
    expect(options).toEqual({
      duration: 6000,
      iterations: Number.POSITIVE_INFINITY,
      easing: "linear",
    });
    expect(keyframes).toEqual([
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: expect.closeTo(1 / 3, 5) },
      { transform: "translateX(-200px)", offset: 1 },
    ]);
  });

  it("should start animating when a resize makes the content overflow", () => {
    let containerWidth = 200;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => containerWidth);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);

    render(<TestComponent text="test" />);

    expect(screen.getByTestId("overflow").textContent).toBe("false");
    expect(animate).not.toHaveBeenCalled();

    containerWidth = 100;
    act(() => {
      sharedObserver().fire();
    });

    expect(screen.getByTestId("overflow").textContent).toBe("true");
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("should not restart the animation when a resize reports the same width", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);

    render(<TestComponent text="very long text" />);
    expect(animate).toHaveBeenCalledTimes(1);

    act(() => {
      sharedObserver().fire();
      sharedObserver().fire();
    });

    expect(animate).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("should not animate when the content fits", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);

    render(<TestComponent text="short" />);

    expect(screen.getByTestId("overflow").textContent).toBe("false");
    expect(screen.getByTestId("animating").textContent).toBe("false");
    expect(animate).not.toHaveBeenCalled();
  });

  it("should not animate when disabled, even while overflowing", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);

    render(<TestComponent text="very long text" enabled={false} />);

    expect(screen.getByTestId("overflow").textContent).toBe("true");
    expect(screen.getByTestId("animating").textContent).toBe("false");
    expect(animate).not.toHaveBeenCalled();
  });

  it("should cancel the animation on unmount", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);

    const { unmount } = render(<TestComponent text="very long text" />);
    expect(cancel).not.toHaveBeenCalled();

    unmount();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("should stop observing the measured elements on unmount", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);

    const { unmount } = render(<TestComponent text="very long text" />);
    expect(sharedObserver().observed.size).toBe(2);

    unmount();

    expect(sharedObserver().observed.size).toBe(0);
  });

  it("should share one ResizeObserver across every instance", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);

    render(
      <>
        <TestComponent text="first long title" />
        <TestComponent text="second long title" />
      </>,
    );

    expect(ResizeObserverMock.instances).toHaveLength(1);
    expect(sharedObserver().observed.size).toBe(4);
  });
});
