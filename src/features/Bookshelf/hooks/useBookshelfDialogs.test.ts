import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookWithState } from "../../../domain/entities";
import { useBookshelfDialogs } from "./useBookshelfDialogs";

describe("useBookshelfDialogs", () => {
  const mockBooks: BookWithState[] = [
    {
      id: 1,
      displayName: "Book 1",
      filePath: "/path/1",
      itemType: "file",
      totalPages: 100,
      seriesId: null,
      seriesOrder: null,
      thumbnailPath: null,
      createdAt: null,
      isSpreadShifted: false,
      landscapeBits: null,
      readingDirection: null,
      lastReadPageIndex: null,
      lastOpenedAt: null,
      cfi: null,
      tagIds: [],
    },
    {
      id: 2,
      displayName: "Book 2",
      filePath: "/path/2",
      itemType: "file",
      totalPages: 200,
      seriesId: null,
      seriesOrder: null,
      thumbnailPath: null,
      createdAt: null,
      isSpreadShifted: false,
      landscapeBits: null,
      readingDirection: null,
      lastReadPageIndex: null,
      lastOpenedAt: null,
      cfi: null,
      tagIds: [],
    },
  ];

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    expect(result.current.dialogType).toBeNull();
    expect(result.current.dialogBookIds).toEqual([]);
    expect(result.current.dialogBooks).toEqual([]);
    expect(result.current.editSeriesOrderSeriesId).toBeNull();
  });

  it("should open a dialog with selected books", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("set-collections", mockBooks);
    });

    expect(result.current.dialogType).toBe("set-collections");
    expect(result.current.dialogBookIds).toEqual([1, 2]);
    expect(result.current.dialogBooks).toEqual(mockBooks);
  });

  it("should open the edit-order dialog for a series", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openEditSeriesOrderDialog(7);
    });

    expect(result.current.dialogType).toBe("edit-series-order");
    expect(result.current.editSeriesOrderSeriesId).toBe(7);
    expect(result.current.dialogBooks).toEqual([]);
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
    expect(result.current.dialogBookIds).toEqual([1, 2]);
    expect(result.current.dialogBooks).toEqual(mockBooks);
  });

  it("should update state when opening a different dialog", () => {
    const { result } = renderHook(() => useBookshelfDialogs());

    act(() => {
      result.current.openDialog("set-collections", [mockBooks[0]]);
    });

    expect(result.current.dialogType).toBe("set-collections");
    expect(result.current.dialogBookIds).toEqual([1]);

    act(() => {
      result.current.openDialog("set-series", [mockBooks[1]]);
    });

    expect(result.current.dialogType).toBe("set-series");
    expect(result.current.dialogBookIds).toEqual([2]);
    expect(result.current.dialogBooks).toEqual([mockBooks[1]]);
  });
});
