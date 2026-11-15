import { basename } from "@tauri-apps/api/path";
import { useEffect } from "react";

/**
 * Custom hook to find the name of the open book, which the file list selects.
 *
 * @param fileHistory The history of file paths.
 * @param fileHistoryIndex The current index in the file history.
 * @param setSelectedName The function to set the selected entry's name; `null` when no book
 * is open.
 */
export function useFileSelection(
  fileHistory: string[],
  fileHistoryIndex: number,
  setSelectedName: (name: string | null) => void,
) {
  useEffect(() => {
    let cancelled = false;
    const initSelected = async () => {
      const currentFile = fileHistory[fileHistoryIndex];
      if (!currentFile) {
        if (!cancelled) {
          setSelectedName(null);
        }
        return;
      }

      const fileName = await basename(currentFile);

      if (!cancelled) {
        setSelectedName(fileName);
      }
    };

    initSelected();

    return () => {
      cancelled = true;
    };
  }, [fileHistory, fileHistoryIndex, setSelectedName]);
}
