import type React from "react";

/**
 * Blurs the focused element after a mouse click, so that a focused side-pane row or tab does
 * not swallow the reader's keys. A keyboard click (`detail === 0`) keeps focus.
 *
 * @param e - The click.
 */
export const releaseMouseFocus = (e: React.MouseEvent): void => {
  if (e.detail > 0 && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};
