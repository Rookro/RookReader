import { useCallback, useState } from "react";

/** Where a context menu was opened, in viewport coordinates. */
export interface ContextMenuAnchor {
  mouseX: number;
  mouseY: number;
  /** True when the menu was opened from the keyboard rather than the pointer. */
  fromKeyboard?: boolean;
}

/**
 * Tracks where a context menu was opened.
 *
 * @returns The anchor (null while closed), an `onContextMenu` handler that opens the menu at
 * the pointer, an `openAt` callback that opens it below a row's left edge from the keyboard,
 * and a `close` callback.
 */
export function useContextMenuAnchor() {
  const [anchor, setAnchor] = useState<ContextMenuAnchor | null>(null);

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchor({ mouseX: e.clientX, mouseY: e.clientY });
  }, []);

  const openAt = useCallback((row: HTMLElement) => {
    const rect = row.getBoundingClientRect();
    setAnchor({ mouseX: rect.left, mouseY: rect.bottom, fromKeyboard: true });
  }, []);

  const close = useCallback(() => setAnchor(null), []);

  return { anchor, open, openAt, close };
}
