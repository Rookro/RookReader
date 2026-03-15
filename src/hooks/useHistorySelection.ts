import { useEffect } from "react";
import { Book } from "../types/DatabaseModels";

/**
 * Custom hook to determine the selected index in a history list.
 *
 * @param path The current file path.
 * @param entries The list of history.
 * @param setSelectedIndex The function to set the selected index.
 */
export function useHistorySelection(
  path: string,
  entries: Book[],
  setSelectedIndex: (index: number) => void,
) {
  useEffect(() => {
    let cancelled = false;
    const initSelected = async () => {
      if (!path || path.length === 0) {
        if (!cancelled) {
          setSelectedIndex(-1);
        }
        return;
      }

      const idx = entries.findIndex((entry) => entry.file_path === path);
      if (!cancelled) {
        setSelectedIndex(idx);
      }
    };

    initSelected();

    return () => {
      cancelled = true;
    };
  }, [entries, setSelectedIndex, path]);
}
