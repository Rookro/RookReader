import { error as logError } from "@tauri-apps/plugin-log";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookCheckStates } from "./useBookCheckStates";

describe("useBookCheckStates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const itemsByBook: Record<number, number[]> = { 10: [1, 2], 11: [1] };
  const load = vi.fn((bookId: number) => Promise.resolve(itemsByBook[bookId]));
  // Stable like the dialog's props: a new array each render would reload every render.
  const twoBooks = [10, 11];
  const oneBook = [10];

  it("starts each item as checked, mixed or unchecked from the books' items", async () => {
    const { result } = renderHook(() =>
      useBookCheckStates({
        open: true,
        bookIds: twoBooks,
        ids: [1, 2, 3],
        load,
        loadErrorMessage: "Failed",
      }),
    );

    await waitFor(() => expect(result.current.changes).toEqual([]));
    expect(result.current.stateOf(1)).toBe("checked");
    expect(result.current.stateOf(2)).toBe("mixed");
    expect(result.current.stateOf(3)).toBe("unchecked");
  });

  it("returns the changed books after a toggle", async () => {
    const { result } = renderHook(() =>
      useBookCheckStates({
        open: true,
        bookIds: twoBooks,
        ids: [1, 2, 3],
        load,
        loadErrorMessage: "Failed",
      }),
    );
    await waitFor(() => expect(result.current.changes).toEqual([]));

    act(() => result.current.toggle(2)); // mixed -> checked
    expect(result.current.stateOf(2)).toBe("checked");
    expect(result.current.changes).toEqual([{ bookId: 11, ids: [1, 2] }]);

    act(() => result.current.toggle(2)); // checked -> unchecked
    act(() => result.current.toggle(2)); // unchecked -> mixed
    expect(result.current.stateOf(2)).toBe("mixed");
    expect(result.current.changes).toEqual([]);
  });

  it("has no changes to save until the items are loaded", () => {
    const { result } = renderHook(() =>
      useBookCheckStates({
        open: true,
        bookIds: oneBook,
        ids: [1],
        load: () => new Promise<number[]>(() => {}),
        loadErrorMessage: "Failed",
      }),
    );

    expect(result.current.changes).toBeNull();
  });

  // Saving without every book's items would overwrite items the dialog never saw
  it("logs and keeps no changes when loading fails", async () => {
    const { result } = renderHook(() =>
      useBookCheckStates({
        open: true,
        bookIds: oneBook,
        ids: [1],
        load: () => Promise.reject(new Error("boom")),
        loadErrorMessage: "Failed to fetch items",
      }),
    );

    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch items")),
    );
    expect(result.current.changes).toBeNull();
  });

  it("ignores a late response for books the dialog no longer edits", async () => {
    let resolveFirst: (ids: number[]) => void = () => {};
    const slowLoad = vi.fn((bookId: number) =>
      bookId === 10
        ? new Promise<number[]>((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve([3]),
    );
    const { result, rerender } = renderHook(
      ({ bookIds }) =>
        useBookCheckStates({
          open: true,
          bookIds,
          ids: [1, 3],
          load: slowLoad,
          loadErrorMessage: "Failed",
        }),
      { initialProps: { bookIds: oneBook } },
    );

    rerender({ bookIds: [11] }); // the same array on every later render
    await waitFor(() => expect(result.current.stateOf(3)).toBe("checked"));
    await act(async () => resolveFirst([1]));

    expect(result.current.stateOf(1)).toBe("unchecked");
    expect(result.current.stateOf(3)).toBe("checked");
  });
});
