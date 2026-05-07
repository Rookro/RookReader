import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { BookSelectionProvider } from "../components/BookSelectionContext";
import { useBookSelection } from "./useBookSelection";

describe("useBookSelection", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1 }),
    createMockBookWithState({ id: 2 }),
    createMockBookWithState({ id: 3 }),
  ];
  const bookIdToIndexMap = new Map([
    [1, 0],
    [2, 1],
    [3, 2],
  ]);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BookSelectionProvider>{children}</BookSelectionProvider>
  );

  it("should initialize with empty selection", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });
    expect(result.current.selectedBookIds.size).toBe(0);
  });

  it("should toggle selection", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    act(() => {
      result.current.toggleSelection(1);
    });
    expect(result.current.selectedBookIds.has(1)).toBe(true);

    act(() => {
      result.current.toggleSelection(1);
    });
    expect(result.current.selectedBookIds.has(1)).toBe(false);
  });

  it("should handle range selection with Shift key", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    // Select first book normally (simulated via handleSelectionClick)
    const event1 = { ctrlKey: true } as React.MouseEvent;
    act(() => {
      result.current.handleSelectionClick(mockBooks[0], event1, mockBooks, bookIdToIndexMap);
    });
    expect(result.current.selectedBookIds.size).toBe(1);

    // Shift-click the third book
    const event2 = { shiftKey: true } as React.MouseEvent;
    act(() => {
      result.current.handleSelectionClick(mockBooks[2], event2, mockBooks, bookIdToIndexMap);
    });

    // Should have selected index 0, 1, and 2
    expect(result.current.selectedBookIds.size).toBe(3);
    expect(result.current.selectedBookIds.has(1)).toBe(true);
    expect(result.current.selectedBookIds.has(2)).toBe(true);
    expect(result.current.selectedBookIds.has(3)).toBe(true);
  });

  it("should clear selection", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    act(() => {
      result.current.toggleSelection(1);
      result.current.toggleSelection(2);
      result.current.clearSelection();
    });

    expect(result.current.selectedBookIds.size).toBe(0);
  });
});
