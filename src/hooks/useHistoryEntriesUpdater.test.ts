import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHistoryEntriesUpdater } from "./useHistoryEntriesUpdater";
import { useAppDispatch, useAppSelector } from "../Store";
import { clearAllHistory, fetchRecentlyReadBooks } from "../reducers/HistoryReducer";

vi.mock("../Store", () => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
}));

vi.mock("../reducers/HistoryReducer", () => ({
  fetchRecentlyReadBooks: vi.fn(() => ({ type: "fetchRecentlyReadBooks" })),
  clearAllHistory: vi.fn(() => ({ type: "clearAllHistory" })),
}));

describe("useHistoryEntriesUpdater", () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useAppSelector).mockReturnValue({ enableHistory: true });
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
    vi.mocked(useAppSelector).mockReturnValue({ enableHistory: false });

    renderHook(() => useHistoryEntriesUpdater());

    expect(mockDispatch).toHaveBeenCalledWith(clearAllHistory());
  });
});
