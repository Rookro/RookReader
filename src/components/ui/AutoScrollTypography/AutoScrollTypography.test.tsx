import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import AutoScrollTypography from "./AutoScrollTypography";
import * as autoScrollHook from "./useAutoScrollAnimation";
import { useMediaQuery } from "@mui/material";

// Mock the hook
vi.mock("./useAutoScrollAnimation", () => ({
  useAutoScrollAnimation: vi.fn(),
}));

// Mock useMediaQuery
vi.mock("@mui/material", async () => {
  const actual = await vi.importActual("@mui/material");
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  };
});

describe("AutoScrollTypography", () => {
  const mockText = "This is a very long text that should scroll";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no reduced motion
    vi.mocked(useMediaQuery).mockReturnValue(false);
  });

  it("should render the text content", () => {
    vi.mocked(autoScrollHook.useAutoScrollAnimation).mockReturnValue({
      containerRef: { current: null },
      contentRef: { current: null },
      isOverflowing: false,
      animationStyle: {},
    });

    renderWithProviders(<AutoScrollTypography text={mockText} />);
    expect(screen.getByText(mockText)).toBeInTheDocument();
  });

  it("should not apply animation when not overflowing", () => {
    vi.mocked(autoScrollHook.useAutoScrollAnimation).mockReturnValue({
      containerRef: { current: null },
      contentRef: { current: null },
      isOverflowing: false,
      animationStyle: {},
    });

    renderWithProviders(<AutoScrollTypography text={mockText} />);

    const typography = screen.getByText(mockText).closest("[data-animating]");
    expect(typography).toHaveAttribute("data-animating", "false");
  });

  it("should apply animation style when overflowing", () => {
    const mockAnimationStyle = { animation: "scroll 10s linear infinite" };
    vi.mocked(autoScrollHook.useAutoScrollAnimation).mockReturnValue({
      containerRef: { current: null },
      contentRef: { current: null },
      isOverflowing: true,
      animationStyle: mockAnimationStyle,
    });

    renderWithProviders(<AutoScrollTypography text={mockText} />);

    const typography = screen.getByText(mockText).closest("[data-animating]");
    expect(typography).toHaveAttribute("data-animating", "true");
  });

  it("should not animate if prefers-reduced-motion is enabled", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(autoScrollHook.useAutoScrollAnimation).mockReturnValue({
      containerRef: { current: null },
      contentRef: { current: null },
      isOverflowing: true,
      animationStyle: { animation: "scroll 10s" },
    });

    renderWithProviders(<AutoScrollTypography text={mockText} />);

    const typography = screen.getByText(mockText).closest("[data-animating]");
    // Even if overflowing, should not animate due to prefers-reduced-motion
    expect(typography).toHaveAttribute("data-animating", "false");
  });
});
