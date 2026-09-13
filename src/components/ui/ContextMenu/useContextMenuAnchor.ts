import { useCallback, useState } from "react";

/** Where a context menu was opened, in viewport coordinates. */
export interface ContextMenuAnchor {
  mouseX: number;
  mouseY: number;
}

/**
 * Tracks where a context menu was opened.
 *
 * @returns The anchor (null while closed), an `onContextMenu` handler that opens the menu at
 * the pointer, and a `close` callback.
 */
export function useContextMenuAnchor() {
  const [anchor, setAnchor] = useState<ContextMenuAnchor | null>(null);

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchor({ mouseX: e.clientX, mouseY: e.clientY });
  }, []);

  const close = useCallback(() => setAnchor(null), []);

  return { anchor, open, close };
}
