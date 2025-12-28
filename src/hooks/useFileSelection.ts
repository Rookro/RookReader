import { useEffect } from 'react';
import { basename } from '@tauri-apps/api/path';
import { DirEntry } from '../types/DirEntry';

/**
 * Custom hook to determine the selected index in a file list based on file history.
 *
 * @param fileHistory The history of file paths.
 * @param fileHistoryIndex The current index in the file history.
 * @param entries The list of directory entries.
 * @param setSelectedIndex The function to set the selected index.
 */
export function useFileSelection(
    fileHistory: string[],
    fileHistoryIndex: number,
    entries: DirEntry[],
    setSelectedIndex: (index: number) => void
) {
    useEffect(() => {
        let cancelled = false;
        const initSelected = async () => {
            const currentFile = fileHistory[fileHistoryIndex];
            if (!currentFile) {
                if (!cancelled) {
                    setSelectedIndex(-1);
                }
                return;
            }

            const fileName = await basename(currentFile);
            const idx = entries.findIndex((entry) => entry.name === fileName);

            if (!cancelled) {
                setSelectedIndex(idx);
            }
        };

        initSelected();

        return () => {
            cancelled = true;
        };
    }, [fileHistory, fileHistoryIndex, entries, setSelectedIndex]);
}
