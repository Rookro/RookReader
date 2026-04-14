import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchTags } from "../slice";
import { useBookTags } from "./useBookTags";

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
    vi.mocked(useAppSelector).mockImplementation((selector: (state: RootState) => unknown) =>
      selector({
        bookCollection: { tag: { status: "idle", tags: [], error: null } },
      } as unknown as RootState),
    );

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
    vi.mocked(useAppSelector).mockImplementation((selector: (state: RootState) => unknown) =>
      selector({ bookCollection: { tag: mockState } } as unknown as RootState),
    );

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
    vi.mocked(useAppSelector).mockImplementation((selector: (state: RootState) => unknown) =>
      selector({ bookCollection: { tag: mockErrorState } } as unknown as RootState),
    );

    const { result } = renderHook(() => useBookTags());

    expect(result.current).toEqual(mockErrorState);
  });
});
