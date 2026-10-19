import type React from "react";
import { useCallback, useRef } from "react";
import type { ViewerSettings } from "../utils/ImageUtils";

/**
 * How long without wheel events ends a wheel gesture, in milliseconds. A gesture turns one
 * page, so a touchpad swipe, which sends a burst of events, does not skip pages.
 */
export const WHEEL_GESTURE_GAP_MS = 100;

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
    (_e: React.MouseEvent | MouseEvent) => {
      onMoveForward();
    },
    [onMoveForward],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      onMoveBack();
    },
    [onMoveBack],
  );

  const lastWheelAtRef = useRef<number | null>(null);

  const handleWheeled = useCallback(
    (e: React.WheelEvent<HTMLDivElement> | WheelEvent) => {
      const now = Date.now();
      const last = lastWheelAtRef.current;
      lastWheelAtRef.current = now;
      if (last !== null && now - last < WHEEL_GESTURE_GAP_MS) {
        return;
      }
      if ("deltaY" in e && e.deltaY < 0) {
        onMoveBack();
      } else if ("deltaY" in e && e.deltaY > 0) {
        onMoveForward();
      }
    },
    [onMoveBack, onMoveForward],
  );

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      // Ignore the event if the user is currently interacting with an input field.
      // This preserves default browser behaviors like moving the cursor with arrow keys.
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isInput) {
        return;
      }

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
