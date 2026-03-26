import { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

/**
 * A custom hook to handle file drag and drop events on the Tauri window.
 *
 * @param props - The callback functions for different drag-and-drop states.
 * @param props.onDrag - Callback triggered when an item is dragged over the window.
 * @param props.onDrop - Callback triggered when items are dropped. Receives an array of file paths.
 * @param props.onLeave - Callback triggered when a dragged item leaves the window area.
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
  useEffect(() => {
    let unlisten: Promise<UnlistenFn> | undefined;

    const startDragDropListener = async () => {
      const appWindow = getCurrentWindow();
      unlisten = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          onDrag?.();
        } else if (event.payload.type === "drop") {
          onDrop?.(event.payload.paths);
        } else if (event.payload.type === "leave") {
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
