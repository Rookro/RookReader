import { watch } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { useEffect, useRef } from "react";
import { useAppSelector } from "../../../store/store";

/**
 * Custom hook to watch a directory for changes and trigger a callback.
 *
 * @param dirPath The path of the directory to watch.
 * @param callback The function to call when a change is detected.
 */
export function useDirectoryWatcher(dirPath: string | null, callback: () => void) {
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
    // while `watch` is still in flight, the resolved watcher would be stored after
    // cleanup and never torn down (a leak); this flag lets us unwatch it immediately.
    let isActive = true;

    const setupWatcher = async () => {
      watcherRef.current?.();
      watcherRef.current = null;

      if (!dirPath) {
        return;
      }

      try {
        const unwatch = await watch(
          dirPath,
          (event) => {
            if (
              typeof event.type === "object" &&
              ("create" in event.type || "modify" in event.type || "remove" in event.type)
            ) {
              callback();
            }
          },
          { delayMs: 500 },
        );

        if (isActive) {
          watcherRef.current = unwatch;
        } else {
          // Cleanup already ran before `watch` resolved — stop the orphaned watcher.
          unwatch();
        }
      } catch (e) {
        error(`Failed to watch ${dirPath}. Error: ${e}`);
      }
    };

    setupWatcher();

    return () => {
      isActive = false;
      watcherRef.current?.();
      watcherRef.current = null;
    };
  }, [dirPath, isWatchEnabled, callback]);
}
