import type React from "react";

/**
 * Keeps a right-button mousedown from focusing a side-pane row. Otherwise the row's context menu
 * restores focus to the row on close, and the row then swallows the reader's `Space`.
 *
 * @param e - The mousedown.
 */
export const preventRightClickFocus = (e: React.MouseEvent): void => {
  if (e.button === 2) {
    e.preventDefault();
  }
};
