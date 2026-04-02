import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBookshelves } from "./useBookshelves";
import { useAppDispatch } from "../../../store/store";
import { fetchBookshelves } from "../slice";

vi.mock("../../../store/store", () => ({
  useAppDispatch: vi.fn(),
}));

vi.mock("../slice", () => ({
  fetchBookshelves: vi.fn(() => ({ type: "fetchBookshelves" })),
}));

describe("useBookshelves", () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
  });

  // Verify that fetchBookshelves action is dispatched on mount
  it("should dispatch fetchBookshelves on mount", () => {
    renderHook(() => useBookshelves());
    expect(mockDispatch).toHaveBeenCalledWith(fetchBookshelves());
  });
});
