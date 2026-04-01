import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBookTags } from "./useBookTags";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchTags } from "../slice";

vi.mock("../../../store/store", () => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
}));

vi.mock("../slice", () => ({
  fetchTags: vi.fn(() => ({ type: "fetchTags" })),
}));

describe("useBookTags", () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
  });

  // Verify that fetchTags action is dispatched on mount
  it("should dispatch fetchTags on mount", () => {
    vi.mocked(useAppSelector).mockReturnValue({
      status: "idle",
      tags: [],
      error: null,
    });

    renderHook(() => useBookTags());

    expect(mockDispatch).toHaveBeenCalledWith(fetchTags());
  });

  // Verify that the tag state from the selector is correctly returned (on success)
  it("should return tag state from selector", () => {
    const mockState = {
      status: "succeeded",
      tags: [{ id: 1, name: "Tag 1", color_code: "#ff0000" }],
      error: null,
    };
    vi.mocked(useAppSelector).mockReturnValue(mockState);

    const { result } = renderHook(() => useBookTags());

    expect(result.current).toEqual(mockState);
  });

  // Verify that the error state is correctly returned when tag fetching fails
  it("should return error state if fetch failed", () => {
    const mockErrorState = {
      status: "failed",
      tags: [],
      error: "Failed to fetch",
    };
    vi.mocked(useAppSelector).mockReturnValue(mockErrorState);

    const { result } = renderHook(() => useBookTags());

    expect(result.current).toEqual(mockErrorState);
  });
});
