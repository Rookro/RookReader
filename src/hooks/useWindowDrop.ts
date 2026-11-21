import { useCallback, useState } from "react";
import { useDragDropEvent } from "./useDragDropEvent";

/**
 * Tracks files dragged over the window and hands over the ones dropped.
 *
 * @param onDrop - Called with the dropped paths.
 * @returns Whether something is being dragged over the window.
 */
export const useWindowDrop = (onDrop: (paths: string[]) => void): boolean => {
  const [isDragging, setIsDragging] = useState(false);
  const handleDrag = useCallback(() => setIsDragging(true), []);
  const handleLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback(
    (paths: string[]) => {
      setIsDragging(false);
      onDrop(paths);
    },
    [onDrop],
  );
  useDragDropEvent({ onDrag: handleDrag, onDrop: handleDrop, onLeave: handleLeave });
  return isDragging;
};
