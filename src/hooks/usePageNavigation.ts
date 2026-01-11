import React, { useCallback } from "react";
import { ViewerSettings } from "../utils/ImageUtils";

/**
 * Hooks for page navigation (forward/backward) based on user interactions.
 *
 * @param onMoveForward Move forward action.
 * @param onMoveBack Move back action.
 * @param direction Direction of the viewer.
 * @returns Handlers for click, context menu, wheel, and keydown events.
 */
export const usePageNavigation = (
  onMoveForward: () => void,
  onMoveBack: () => void,
  direction: ViewerSettings["direction"],
) => {
  const handleClicked = useCallback(
    (_e: React.MouseEvent) => {
      onMoveForward();
    },
    [onMoveForward],
  );

  const handleContextMenu = useCallback(
    (_e: React.MouseEvent) => {
      onMoveBack();
    },
    [onMoveBack],
  );

  const handleWheeled = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.deltaY < 0) {
        onMoveBack();
      } else if (e.deltaY > 0) {
        onMoveForward();
      }
    },
    [onMoveBack, onMoveForward],
  );

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          if (direction === "rtl") {
            onMoveForward();
          } else {
            onMoveBack();
          }
          break;
        case "ArrowRight":
          if (direction === "rtl") {
            onMoveBack();
          } else {
            onMoveForward();
          }
          break;
        default:
          return;
      }
    },
    [direction, onMoveForward, onMoveBack],
  );

  return { handleClicked, handleContextMenu, handleWheeled, handleKeydown };
};
