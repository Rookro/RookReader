import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

/**
 * A custom hook to handle file drag and drop events on the Tauri window.
 *
 * @param props - The callback functions for different drag-and-drop states.
 * @param props.onDrag - Callback triggered when a file drag enters or moves over the window.
 * @param props.onDrop - Callback triggered when files are dropped. Receives an array of file paths.
 * @param props.onLeave - Callback triggered when a file drag leaves the window or a drop brings no files.
 */
export const useDragDropEvent = ({
  onDrag,
  onDrop,
  onLeave,
}: {
  onDrag?: () => void;
  onDrop?: (paths: string[]) => void;
  onLeave?: () => void;
}) => {
  // On Windows, after a file drop wry sends `over` and an empty `drop` for in-app drags (a cover,
  // a page) without an `enter`, so only a drag that entered with files counts. Kept outside the
  // effect so it survives a re-subscription mid-drag.
  const isFileDrag = useRef(false);

  useEffect(() => {
    let unlisten: Promise<UnlistenFn> | undefined;

    const startDragDropListener = async () => {
      const appWindow = getCurrentWindow();
      unlisten = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === "enter") {
          isFileDrag.current = event.payload.paths.length > 0;
          if (isFileDrag.current) {
            onDrag?.();
          }
        } else if (event.payload.type === "over") {
          if (isFileDrag.current) {
            onDrag?.();
          }
        } else if (event.payload.type === "drop") {
          isFileDrag.current = false;
          if (event.payload.paths.length > 0) {
            onDrop?.(event.payload.paths);
          } else {
            onLeave?.();
          }
        } else if (event.payload.type === "leave") {
          isFileDrag.current = false;
          onLeave?.();
        }
      });
    };

    startDragDropListener();

    return () => {
      unlisten?.then((unlisten) => unlisten());
    };
  }, [onDrag, onDrop, onLeave]);
};
