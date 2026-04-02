import { useMediaQuery } from "@mui/material";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "../store/store";
import { useAppTheme } from "./useAppTheme";

vi.mock("../store/store", () => ({
  useAppSelector: vi.fn(),
}));

vi.mock("@mui/material", async () => {
  const actual = await vi.importActual("@mui/material");
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  };
});

describe("useAppTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that light theme is correctly returned when dark mode is disabled
  it("should return a light theme when prefersDarkMode is false", () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.mocked(useAppSelector).mockReturnValue("Roboto");

    const { result } = renderHook(() => useAppTheme());

    expect(result.current.palette.mode).toBe("light");
    expect(result.current.typography.fontFamily).toBe("Roboto");
  });

  // Verify that dark theme is correctly returned when dark mode is enabled
  it("should return a dark theme when prefersDarkMode is true", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(useAppSelector).mockReturnValue("Arial");

    const { result } = renderHook(() => useAppTheme());

    expect(result.current.palette.mode).toBe("dark");
    expect(result.current.palette.background.paper).toBe("#2f2f2f");
    expect(result.current.typography.fontFamily).toBe("Arial");
  });

  // Verify that theme style overrides (e.g., CSS Baseline) are correctly defined and executable
  it("should have styleOverrides that can be executed", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(useAppSelector).mockReturnValue("Roboto");

    const { result } = renderHook(() => useAppTheme());
    const theme = result.current;

    const styleOverrides = theme.components?.MuiCssBaseline?.styleOverrides;
    expect(styleOverrides).toBeDefined();

    if (typeof styleOverrides === "function") {
      const styles = styleOverrides(theme) as Record<string, { [key: string]: unknown }>;
      expect(styles.body).toBeDefined();
      expect(styles.body["*::-webkit-scrollbar"]).toBeDefined();
    }
  });
});
