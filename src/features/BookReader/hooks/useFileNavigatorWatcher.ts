import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { loadDirectory } from "../fileNavigatorSlice";
import { useDirectoryWatcher } from "./useDirectoryWatcher";

/**
 * Keeps the File Navigator's current folder watched for filesystem changes.
 *
 * Mounted by the reader, which stays mounted across side-pane tab switches and behind
 * the bookshelf, rather than by the File Navigator tab: changes made while another tab
 * is active are reflected in the background, and switching tabs does not tear down and
 * re-open the watcher on a NAS share.
 */
export function useFileNavigatorWatcher(): void {
  const dispatch = useAppDispatch();
  // Select the primitive path so BookReader does not re-render when entries or search change.
  const dirPath = useAppSelector(
    (state) => state.fileNavigator.history[state.fileNavigator.historyIndex] ?? null,
  );

  // Return the dispatch promise so `useDirectoryWatcher` serializes slow NAS refreshes.
  const refreshInBackground = useCallback(() => {
    if (dirPath) {
      return dispatch(loadDirectory({ dirPath, background: true }));
    }
  }, [dirPath, dispatch]);

  useDirectoryWatcher(dirPath, refreshInBackground);
}
