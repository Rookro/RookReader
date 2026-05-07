import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookshelfActionsContext, useBookshelfActions } from "./BookshelfActionsContext";

describe("BookshelfActionsContext", () => {
  it("should throw error when used outside of BookshelfActionsProvider", () => {
    // Suppress console.error for this test as we expect an error to be logged
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useBookshelfActions())).toThrow(
      "useBookshelfActions must be used within a BookshelfActionsProvider",
    );

    consoleSpy.mockRestore();
  });

  it("should return context when used within BookshelfActionsProvider", () => {
    const mockActions = {
      openDialog: vi.fn(),
      refreshBookshelf: vi.fn(),
      refreshSeries: vi.fn(),
    };

    const { result } = renderHook(() => useBookshelfActions(), {
      wrapper: ({ children }) => (
        <BookshelfActionsContext.Provider value={mockActions}>
          {children}
        </BookshelfActionsContext.Provider>
      ),
    });

    expect(result.current).toBe(mockActions);
  });
});
