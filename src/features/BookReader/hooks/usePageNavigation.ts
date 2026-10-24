import type React from "react";
import { useCallback } from "react";
import type { ViewerSettings } from "../utils/ImageUtils";
import { toWheelSample, wheelGesture } from "../utils/wheelGesture";

/** How a page move may behave. */
export interface PageMoveOptions {
  /** How many pages (displayed units) to move. Defaults to 1. */
  steps?: number;
  /** Whether a move at the first or last page may go on to the adjacent book. Defaults to true. */
  crossBook?: boolean;
}

/** Moves pages; returns false when it stopped short of `steps` (boundary, hand-off, nothing loaded). */
export type PageMove = (options?: PageMoveOptions) => boolean;

/**
 * Hooks for page navigation (forward/backward) based on user interactions.
 *
 * @param onMoveForward Moves forward; see {@link PageMove}.
 * @param onMoveBack Moves back; see {@link PageMove}.
 * @param direction Direction of the viewer.
 * @returns Handlers for click, context menu, wheel, and keydown events.
 */
export const usePageNavigation = (
  onMoveForward: PageMove,
  onMoveBack: PageMove,
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

  const handleWheeled = useCallback(
    (e: React.WheelEvent<HTMLDivElement> | WheelEvent) => {
      wheelGesture.handle(toWheelSample(e), (sign, steps, crossBook) =>
        (sign > 0 ? onMoveForward : onMoveBack)({ steps, crossBook }),
      );
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
