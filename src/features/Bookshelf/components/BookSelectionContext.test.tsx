import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { useBookSelection } from "../hooks/useBookSelection";
import { BookSelectionProvider } from "./BookSelectionContext";

describe("BookSelectionContext", () => {
  it("should throw error when used outside of BookSelectionProvider", () => {
    // Suppress console.error for this test as we expect an error to be logged
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useBookSelection())).toThrow(
      "useBookSelection must be used within a BookSelectionProvider",
    );

    consoleSpy.mockRestore();
  });

  const mockBooks = [
    createMockBookWithState({ id: 1 }),
    createMockBookWithState({ id: 2 }),
    createMockBookWithState({ id: 3 }),
    createMockBookWithState({ id: 4 }),
  ];

  const bookIdToIndexMap = new Map(mockBooks.map((b, i) => [b.id, i]));

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BookSelectionProvider>{children}</BookSelectionProvider>
  );

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

  it("should handle ctrl-click to toggle selection", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    act(() => {
      result.current.handleSelectionClick(
        mockBooks[0],
        { ctrlKey: true } as React.MouseEvent,
        mockBooks,
        bookIdToIndexMap,
      );
    });
    expect(result.current.selectedBookIds.has(1)).toBe(true);

    act(() => {
      result.current.handleSelectionClick(
        mockBooks[0],
        { ctrlKey: true } as React.MouseEvent,
        mockBooks,
        bookIdToIndexMap,
      );
    });
    expect(result.current.selectedBookIds.has(1)).toBe(false);
  });

  it("should handle shift-click range selection", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    // Click first book
    act(() => {
      result.current.handleSelectionClick(
        mockBooks[0],
        { ctrlKey: true } as React.MouseEvent,
        mockBooks,
        bookIdToIndexMap,
      );
    });

    // Shift-click fourth book
    act(() => {
      result.current.handleSelectionClick(
        mockBooks[3],
        { shiftKey: true } as React.MouseEvent,
        mockBooks,
        bookIdToIndexMap,
      );
    });

    expect(result.current.selectedBookIds.size).toBe(4);
    expect(result.current.selectedBookIds.has(1)).toBe(true);
    expect(result.current.selectedBookIds.has(2)).toBe(true);
    expect(result.current.selectedBookIds.has(3)).toBe(true);
    expect(result.current.selectedBookIds.has(4)).toBe(true);
  });

  it("should clear selection and select new book when clicking without modifiers", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    act(() => {
      result.current.toggleSelection(1);
      result.current.toggleSelection(2);
    });
    expect(result.current.selectedBookIds.size).toBe(2);

    act(() => {
      result.current.handleSelectionClick(
        mockBooks[2],
        {} as React.MouseEvent,
        mockBooks,
        bookIdToIndexMap,
      );
    });

    expect(result.current.selectedBookIds.size).toBe(1);
    expect(result.current.selectedBookIds.has(3)).toBe(true);
  });

  it("should call onBookSelect when clicking without modifiers and no previous selection", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });
    const onBookSelect = vi.fn();

    act(() => {
      result.current.handleSelectionClick(
        mockBooks[0],
        {} as React.MouseEvent,
        mockBooks,
        bookIdToIndexMap,
        onBookSelect,
      );
    });

    expect(onBookSelect).toHaveBeenCalledWith(mockBooks[0]);
    expect(result.current.selectedBookIds.size).toBe(0);
  });

  it("should clear all selections", () => {
    const { result } = renderHook(() => useBookSelection(), { wrapper });

    act(() => {
      result.current.toggleSelection(1);
      result.current.toggleSelection(2);
    });
    expect(result.current.selectedBookIds.size).toBe(2);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedBookIds.size).toBe(0);
  });
});
