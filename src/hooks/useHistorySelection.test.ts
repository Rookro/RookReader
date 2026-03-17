import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHistorySelection } from "./useHistorySelection";
import { Book } from "../types/DatabaseModels";

describe("useHistorySelection", () => {
  const mockEntries: Book[] = [
    { file_path: "p1" } as Book,
    { file_path: "p2" } as Book,
    { file_path: "p3" } as Book,
  ];

  // Verify that the selected index is set correctly for entries matching the specified path
  it("should set selected index to match the path", () => {
    const setSelectedIndex = vi.fn();
    renderHook(() => useHistorySelection("p2", mockEntries, setSelectedIndex));
    expect(setSelectedIndex).toHaveBeenCalledWith(1);
  });

  // Verify that the selected index is set to -1 if the path is not found
  it("should set selected index to -1 if path is not found", () => {
    const setSelectedIndex = vi.fn();
    renderHook(() => useHistorySelection("nonexistent", mockEntries, setSelectedIndex));
    expect(setSelectedIndex).toHaveBeenCalledWith(-1);
  });

  // Verify that the selected index is set to -1 if the path is empty
  it("should set selected index to -1 if path is empty", () => {
    const setSelectedIndex = vi.fn();
    renderHook(() => useHistorySelection("", mockEntries, setSelectedIndex));
    expect(setSelectedIndex).toHaveBeenCalledWith(-1);
  });

  // Verify that the selected index is dynamically updated when the path changes
  it("should update selected index when path changes", () => {
    const setSelectedIndex = vi.fn();
    const { rerender } = renderHook(
      ({ path }) => useHistorySelection(path, mockEntries, setSelectedIndex),
      { initialProps: { path: "p1" } },
    );
    expect(setSelectedIndex).toHaveBeenCalledWith(0);

    rerender({ path: "p3" });
    expect(setSelectedIndex).toHaveBeenCalledWith(2);
  });
});
