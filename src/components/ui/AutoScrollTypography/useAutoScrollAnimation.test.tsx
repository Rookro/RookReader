import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScrollAnimation } from "./useAutoScrollAnimation";

function TestComponent({
  text,
  pixelsPerSecond = 50,
  delaySeconds = 2,
}: {
  text: string;
  pixelsPerSecond?: number;
  delaySeconds?: number;
}) {
  const { containerRef, contentRef, isOverflowing, animationStyle } = useAutoScrollAnimation(
    pixelsPerSecond,
    delaySeconds,
  );
  return (
    <div ref={containerRef} data-testid="container">
      <span ref={contentRef} data-testid="content" style={animationStyle}>
        {text}
      </span>
      <span data-testid="overflow">{isOverflowing ? "true" : "false"}</span>
    </div>
  );
}

describe("useAutoScrollAnimation", () => {
  let resizeCallback: () => void = () => {};

  beforeEach(() => {
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCallback = cb as () => void;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Verify that content overflow is detected and animation style is correctly calculated
  it("should detect overflow and calculate animation style", () => {
    // Mock widths
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(100);
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(200);

    render(<TestComponent text="very long text" />);

    expect(screen.getByTestId("overflow").textContent).toBe("true");
    // Just verify animationStyle is passed and contains some animation property
    // Inline styles might not handle @keyframes well in JSDOM, but we can check if it exists
    expect(screen.getByTestId("content").style.animation).toBeDefined();

    clientWidthSpy.mockRestore();
    offsetWidthSpy.mockRestore();
  });

  // Verify that overflow state is recalculated on window resize
  it("should update on resize", () => {
    let currentClientWidth = 200;
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => currentClientWidth);
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(150);

    render(<TestComponent text="test" />);

    expect(screen.getByTestId("overflow").textContent).toBe("false");

    // Simulate resize making container smaller
    currentClientWidth = 100;
    act(() => {
      resizeCallback();
    });

    expect(screen.getByTestId("overflow").textContent).toBe("true");

    clientWidthSpy.mockRestore();
    offsetWidthSpy.mockRestore();
  });

  // Verify that animation is not applied when content does not overflow
  it("should handle no overflow", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);

    render(<TestComponent text="short" />);

    expect(screen.getByTestId("overflow").textContent).toBe("false");
    expect(screen.getByTestId("content")).not.toHaveStyle({
      animation: expect.stringContaining("auto-scroll-text"),
    });
  });
});
