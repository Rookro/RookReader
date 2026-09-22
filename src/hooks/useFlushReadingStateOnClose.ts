import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { useAppStore } from "../store/store";

/**
 * Writes the pending reading position before the window closes.
 *
 * Tauri destroys the window only after the close-requested handler resolves, so awaiting
 * the write here is what makes the last page turn survive a close. Once a handler is
 * registered the window is destroyed from here, which needs `core:window:allow-destroy`
 * in the capability; without it the close button does nothing.
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
