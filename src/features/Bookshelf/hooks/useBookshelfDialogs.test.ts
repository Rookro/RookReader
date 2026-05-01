import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { useBookshelfDialogs } from "./useBookshelfDialogs";

describe("useBookshelfDialogs", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Book 1" }),
    createMockBookWithState({ id: 2, display_name: "Book 2" }),
  ];

  it("should initialize with null dialog type", () => {
    const { result } = renderHook(() => useBookshelfDialogs());
    expect(result.current.dialogType).toBeNull();
    expect(result.current.selectedBookIds).toEqual([]);
    expect(result.current.selectedBooks).toEqual([]);
  });

  it("should open dialog with specific type and books", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("add-to-bookshelf", mockBooks);
    });

    expect(result.current.dialogType).toBe("add-to-bookshelf");
    expect(result.current.selectedBookIds).toEqual([1, 2]);
    expect(result.current.selectedBooks).toEqual(mockBooks);
  });

  it("should close dialog but keep data", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("delete-books", mockBooks);
    });

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.dialogType).toBeNull();
    // Data remains until clearDialogData or next openDialog
    expect(result.current.selectedBookIds).toEqual([1, 2]);
  });

  it("should clear dialog data", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("set-tags", mockBooks);
      result.current.clearDialogData();
    });

    expect(result.current.dialogType).toBeNull();
    expect(result.current.selectedBookIds).toEqual([]);
    expect(result.current.selectedBooks).toEqual([]);
  });
});
