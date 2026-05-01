import { error } from "@tauri-apps/plugin-log";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaneSizes } from "./usePaneSizes";

vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(),
}));

describe("usePaneSizes", () => {
  const TEST_KEY = "test-pane-sizes";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("should initialize with undefined if localStorage is empty", () => {
    const { result } = renderHook(() => usePaneSizes(TEST_KEY));
    expect(result.current.paneSizes).toBeUndefined();
  });

  it("should initialize with values from localStorage if valid", () => {
    localStorage.setItem(TEST_KEY, JSON.stringify([200, 800]));
    const { result } = renderHook(() => usePaneSizes(TEST_KEY));
    expect(result.current.paneSizes).toEqual([200, 800]);
  });

  it("should ignore invalid values from localStorage and log error", () => {
    localStorage.setItem(TEST_KEY, "invalid-json");

    const { result } = renderHook(() => usePaneSizes(TEST_KEY));

    expect(result.current.paneSizes).toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to parse test-pane-sizes:"));
  });

  it("should ignore non-array or non-number array valid JSON values", () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => usePaneSizes(TEST_KEY));
    expect(result.current.paneSizes).toBeUndefined();

    localStorage.setItem(TEST_KEY, JSON.stringify(["a", "b"]));
    const { result: _ } = renderHook(() => usePaneSizes(TEST_KEY));
    // Since result2 isn't used directly here, we just re-render to check behavior
    const { result: r3 } = renderHook(() => usePaneSizes(TEST_KEY));
    expect(r3.current.paneSizes).toBeUndefined();
  });

  it("should debounce updating localStorage", () => {
    const { result } = renderHook(() => usePaneSizes(TEST_KEY));

    result.current.handlePaneSizeChanged([300, 700]);

    // Should not be updated immediately due to debounce
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    // Fast forward time
    vi.advanceTimersByTime(500);

    // Now it should be updated
    expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify([300, 700]));
  });
});
