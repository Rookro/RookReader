import { useMemo } from "react";
import type { Book } from "../../../domain/book/schema";

/**
 * Locates the open book within a history list.
 *
 * @param path - The path of the open container file.
 * @param entries - The history entries currently listed.
 * @returns The index of the entry whose path matches, or -1 when there is no open book or no match.
 */
export function useHistoryIndex(path: string, entries: Book[]): number {
  return useMemo(
    () => (path ? entries.findIndex((entry) => entry.file_path === path) : -1),
    [path, entries],
  );
}
