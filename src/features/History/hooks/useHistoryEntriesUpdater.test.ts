import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { clearAllHistory, fetchRecentlyReadBooks } from "../slice";
import { useHistoryEntriesUpdater } from "./useHistoryEntriesUpdater";

vi.mock("../../../store/store", () => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
}));

vi.mock("../slice", () => ({
  fetchRecentlyReadBooks: vi.fn(() => ({ type: "fetchRecentlyReadBooks" })),
  clearAllHistory: vi.fn(() => ({ type: "clearAllHistory" })),
}));

describe("useHistoryEntriesUpdater", () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useAppSelector).mockReturnValue(true);
  });

  // Verify that recently read books are fetched on initialization if history is enabled
  it("should initialize history and fetch books if enabled", async () => {
    renderHook(() => useHistoryEntriesUpdater());

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(fetchRecentlyReadBooks());
    });
  });

  // Verify that history information is cleared when history function is disabled
  it("should clear history when enableHistory becomes false", () => {
    vi.mocked(useAppSelector).mockReturnValue(false);

    renderHook(() => useHistoryEntriesUpdater());

    expect(mockDispatch).toHaveBeenCalledWith(clearAllHistory());
  });
});
