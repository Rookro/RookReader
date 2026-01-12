import { useEffect, useRef } from "react";
import { watch } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { useAppSelector } from "../Store";

/**
 * Custom hook to watch a directory for changes and trigger a callback.
 *
 * @param dirPath The path of the directory to watch.
 * @param callback The function to call when a change is detected.
 */
export function useDirectoryWatcher(dirPath: string | null, callback: () => void) {
  const watcherRef = useRef<null | (() => void)>(null);
  const { isWatchEnabled } = useAppSelector((state) => state.file.explorer);

  useEffect(() => {
    if (!isWatchEnabled) {
      watcherRef.current?.();
      watcherRef.current = null;
      return;
    }

    const setupWatcher = async () => {
      watcherRef.current?.();
      watcherRef.current = null;

      if (!dirPath) {
        return;
      }

      let unwatch = null;
      try {
        unwatch = await watch(
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
      } catch (e) {
        error(`Failed to watch ${dirPath}. Error: ${e}`);
      }
      watcherRef.current = unwatch;
    };

    setupWatcher();

    return () => {
      watcherRef.current?.();
      watcherRef.current = null;
    };
  }, [dirPath, isWatchEnabled, callback]);
}
