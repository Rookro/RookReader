import type React from "react";
import { useCallback } from "react";
import { useReaderInput } from "../input/ReaderInputContext";
import type { PointerPosition } from "../input/types";
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
 * The reading area's receiver: hands its clicks, context menu and wheel to the reader input
 * dispatcher.
 *
 * @returns Handlers for click, context menu and wheel events. The click and context menu handlers
 *   take the click's position in the top document's client coordinates as `at`, which defaults to
 *   the event's own.
 * @throws Error outside `ReaderInputProvider`.
 */
export const usePageNavigation = () => {
  const { dispatchInput } = useReaderInput();

  const handleClicked = useCallback(
    (e: React.MouseEvent | MouseEvent, at?: PointerPosition) => {
      dispatchInput({
        kind: "click",
        button: "left",
        at: at ?? { clientX: e.clientX, clientY: e.clientY },
      });
    },
    [dispatchInput],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent, at?: PointerPosition) => {
      e.preventDefault();
      dispatchInput({
        kind: "click",
        button: "right",
        at: at ?? { clientX: e.clientX, clientY: e.clientY },
      });
    },
    [dispatchInput],
  );

  const handleWheeled = useCallback(
    (e: React.WheelEvent | WheelEvent) => {
      wheelGesture.handle(toWheelSample(e), (direction, steps, crossBook) =>
        dispatchInput({ kind: "wheel", direction, steps, crossBook }),
      );
    },
    [dispatchInput],
  );

  return { handleClicked, handleContextMenu, handleWheeled };
};
