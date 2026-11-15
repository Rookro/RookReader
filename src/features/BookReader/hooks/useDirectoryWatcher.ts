import { exists, watchImmediate } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { useEffect, useRef } from "react";
import { useAppSelector } from "../../../store/store";

/** How long changes are collected before the callback runs once for all of them. */
const CHANGE_DELAY_MS = 500;

/**
 * Custom hook to watch a directory for changes and trigger a callback.
 *
 * The callback runs once, 500 ms after the first change, for every change reported in
 * that time. While a callback that returned a promise is still running, changes wait:
 * the next 500 ms start when it settles.
 *
 * @param dirPath The path of the directory to watch.
 * @param callback The function to call when a change is detected. It may return a promise
 * that settles when its work is done.
 */
export function useDirectoryWatcher(dirPath: string | null, callback: () => unknown) {
  const watcherRef = useRef<null | (() => void)>(null);
  const isWatchEnabled = useAppSelector(
    (state) => state.settings.fileNavigator.watchDirectoryChanges,
  );

  useEffect(() => {
    if (!isWatchEnabled) {
      watcherRef.current?.();
      watcherRef.current = null;
      return;
    }

    // Tracks whether this effect run is still active. If the effect is cleaned up
    // while `watchImmediate` is still in flight, the resolved watcher would be stored
    // after cleanup and never torn down (a leak); this flag lets us unwatch it immediately.
    let isActive = true;
    // The pending call of `callback`: the first change starts it, later ones share it.
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A call of `callback` is still running; a change during it asks for one more call.
    let isRunning = false;
    let changedWhileRunning = false;

    const startDelay = () => {
      timer = setTimeout(async () => {
        timer = null;
        isRunning = true;
        changedWhileRunning = false;
        try {
          await callback();
        } finally {
          isRunning = false;
          if (isActive && changedWhileRunning) {
            startDelay();
          }
        }
      }, CHANGE_DELAY_MS);
    };

    const setupWatcher = async () => {
      watcherRef.current?.();
      watcherRef.current = null;

      if (!dirPath) {
        return;
      }

      try {
        // A path inside an archive (`comic.zip/ch1`) has nothing on disk to watch.
        // Asking the filesystem is what tells it apart from a real folder that merely
        // happens to be named `comic.zip`, whose children must keep being watched — the
        // same "a real path wins" rule the backend resolves archive paths by.
        if (!(await exists(dirPath))) {
          return;
        }

        // Not the debounced `watch`: when it starts, it reads every file of the folder on
        // the app's main thread, which freezes the window in a large folder.
        const unwatch = await watchImmediate(dirPath, (event) => {
          if (
            !isActive ||
            typeof event.type !== "object" ||
            !("create" in event.type || "modify" in event.type || "remove" in event.type)
          ) {
            return;
          }
          if (isRunning) {
            changedWhileRunning = true;
          } else if (timer === null) {
            startDelay();
          }
        });

        if (isActive) {
          watcherRef.current = unwatch;
        } else {
          // Cleanup already ran before `watchImmediate` resolved — stop the orphaned watcher.
          unwatch();
        }
      } catch (e) {
        error(`Failed to watch ${dirPath}. Error: ${e}`);
      }
    };

    setupWatcher();

    return () => {
      isActive = false;
      if (timer !== null) {
        clearTimeout(timer);
      }
      watcherRef.current?.();
      watcherRef.current = null;
    };
  }, [dirPath, isWatchEnabled, callback]);
}
