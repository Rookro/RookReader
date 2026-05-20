import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookWithState } from "../../../types/DatabaseModels";
import { useBookshelfDialogs } from "./useBookshelfDialogs";

describe("useBookshelfDialogs", () => {
  const mockBooks: BookWithState[] = [
    {
      id: 1,
      display_name: "Book 1",
      file_path: "/path/1",
      item_type: "file",
      total_pages: 100,
      series_id: null,
      series_order: null,
      thumbnail_path: null,
      last_read_page_index: null,
      last_opened_at: null,
      tag_ids: [],
    },
    {
      id: 2,
      display_name: "Book 2",
      file_path: "/path/2",
      item_type: "file",
      total_pages: 200,
      series_id: null,
      series_order: null,
      thumbnail_path: null,
      last_read_page_index: null,
      last_opened_at: null,
      tag_ids: [],
    },
  ];

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    expect(result.current.dialogType).toBeNull();
    expect(result.current.selectedBookIds).toEqual([]);
    expect(result.current.selectedBooks).toEqual([]);
  });

  it("should open a dialog with selected books", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("add-to-bookshelf", mockBooks);
    });

    expect(result.current.dialogType).toBe("add-to-bookshelf");
    expect(result.current.selectedBookIds).toEqual([1, 2]);
    expect(result.current.selectedBooks).toEqual(mockBooks);
  });

  it("should close the dialog but keep the selected data", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("delete-books", mockBooks);
    });

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.dialogType).toBeNull();
    // closeDialog only resets the type to null to allow for closing animations
    expect(result.current.selectedBookIds).toEqual([1, 2]);
    expect(result.current.selectedBooks).toEqual(mockBooks);
  });

  it("should clear all dialog data", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("set-tags", mockBooks);
    });

    act(() => {
      result.current.clearDialogData();
    });

    expect(result.current.dialogType).toBeNull();
    expect(result.current.selectedBookIds).toEqual([]);
    expect(result.current.selectedBooks).toEqual([]);
  });

  it("should update state when opening a different dialog", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("add-to-bookshelf", [mockBooks[0]]);
    });

    expect(result.current.dialogType).toBe("add-to-bookshelf");
    expect(result.current.selectedBookIds).toEqual([1]);

    act(() => {
      result.current.openDialog("set-series", [mockBooks[1]]);
    });

    expect(result.current.dialogType).toBe("set-series");
    expect(result.current.selectedBookIds).toEqual([2]);
    expect(result.current.selectedBooks).toEqual([mockBooks[1]]);
  });
});
