import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Book } from "../../../domain/book/schema";
import { useHistoryIndex } from "./useHistoryIndex";

describe("useHistoryIndex", () => {
  const mockEntries: Book[] = [
    { file_path: "p1" } as Book,
    { file_path: "p2" } as Book,
    { file_path: "p3" } as Book,
  ];

  it("should return the index of the entry matching the path", () => {
    const { result } = renderHook(() => useHistoryIndex("p2", mockEntries));
    expect(result.current).toBe(1);
  });

  it("should return -1 if the path is not found", () => {
    const { result } = renderHook(() => useHistoryIndex("nonexistent", mockEntries));
    expect(result.current).toBe(-1);
  });

  it("should return -1 if the path is empty", () => {
    const { result } = renderHook(() => useHistoryIndex("", mockEntries));
    expect(result.current).toBe(-1);
  });

  it("should follow the path when it changes", () => {
    const { result, rerender } = renderHook(({ path }) => useHistoryIndex(path, mockEntries), {
      initialProps: { path: "p1" },
    });
    expect(result.current).toBe(0);

    rerender({ path: "p3" });
    expect(result.current).toBe(2);
  });
});
