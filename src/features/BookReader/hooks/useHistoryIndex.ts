import { useMemo } from "react";
import type { BookWithState } from "../../../domain/entities";

/**
 * Locates the open book within a history list.
 *
 * @param path - The path of the open container file.
 * @param entries - The history entries currently listed.
 * @returns The index of the entry whose path matches, or -1 when there is no open book or no match.
 */
export function useHistoryIndex(path: string, entries: Pick<BookWithState, "filePath">[]): number {
  return useMemo(
    () => (path ? entries.findIndex((entry) => entry.filePath === path) : -1),
    [path, entries],
  );
}
