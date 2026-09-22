import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { useAppStore } from "../store/store";

/**
 * Writes the pending reading position before the window closes.
 *
 * Tauri destroys the window only after the close-requested handler resolves, so awaiting
 * the write here is what makes the last page turn survive a close.
 */
export const useFlushReadingStateOnClose = () => {
  const store = useAppStore();
  useEffect(() => {
    const unlisten: Promise<UnlistenFn> = getCurrentWindow().onCloseRequested(async () => {
      await store.flushReadingState();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [store]);
};
