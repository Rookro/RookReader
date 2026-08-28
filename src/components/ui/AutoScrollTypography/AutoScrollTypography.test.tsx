import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import AutoScrollTypography from "./AutoScrollTypography";
import * as autoScrollHook from "./useAutoScrollAnimation";

// Mock the hook
vi.mock("./useAutoScrollAnimation", () => ({
  useAutoScrollAnimation: vi.fn(),
}));

/** Builds the hook's return value with the animation state under test. */
function mockHook(shouldAnimate: boolean) {
  vi.mocked(autoScrollHook.useAutoScrollAnimation).mockReturnValue({
    containerRef: { current: null },
    contentRef: { current: null },
    scrollRef: { current: null },
    isOverflowing: shouldAnimate,
    shouldAnimate,
    metrics: shouldAnimate ? { contentWidth: 200, durationMs: 6000, delayFraction: 1 / 3 } : null,
  });
}

describe("AutoScrollTypography", () => {
  const mockText = "This is a very long text that should scroll";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the text content", () => {
    mockHook(false);

    renderWithProviders(<AutoScrollTypography text={mockText} />);
    expect(screen.getByText(mockText)).toBeInTheDocument();
  });

  it("should clamp the text with an ellipsis when not animating", () => {
    mockHook(false);

    renderWithProviders(<AutoScrollTypography text={mockText} />);

    const typography = screen.getByText(mockText).closest("[data-animating]");
    expect(typography).toHaveAttribute("data-animating", "false");
    expect(typography).toHaveStyle({ textOverflow: "ellipsis" });
  });

  it("should promote the text to its own layer while animating", () => {
    mockHook(true);

    renderWithProviders(<AutoScrollTypography text={mockText} />);

    const typography = screen.getByText(mockText).closest("[data-animating]");
    expect(typography).toHaveAttribute("data-animating", "true");
    expect(typography).toHaveStyle({ display: "inline-block", willChange: "transform" });
  });

  it("should pass the animation settings to the hook", () => {
    mockHook(true);

    renderWithProviders(
      <AutoScrollTypography
        text={mockText}
        enabled={false}
        pixelsPerSecond={40}
        delaySeconds={5}
      />,
    );

    expect(autoScrollHook.useAutoScrollAnimation).toHaveBeenCalledWith(false, 40, 5);
  });

  it("should keep styles supplied by the caller", () => {
    mockHook(true);

    renderWithProviders(<AutoScrollTypography text={mockText} sx={{ paddingTop: "8px" }} />);

    const typography = screen.getByText(mockText).closest("[data-animating]");
    expect(typography).toHaveStyle({ paddingTop: "8px" });
  });
});
