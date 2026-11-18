import { useCallback, useRef, useState } from "react";
import type { PointerPosition } from "../input/types";

/**
 * The comic reader's loupe: whether it is on and where it is.
 *
 * @returns The loupe's state, the container it is positioned in, and its handlers.
 */
export function useLoupe() {
  const [isLoupeEnabled, setIsLoupeEnabled] = useState(false);
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // A loupe switched on by a mouse button appears under the cursor before the mouse moves.
  const toggleLoupe = useCallback((at?: PointerPosition) => {
    setIsLoupeEnabled((prev) => {
      const nextState = !prev;
      if (nextState && at && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setLoupePos({
          x: at.clientX - rect.left,
          y: at.clientY - rect.top,
        });
      }
      return nextState;
    });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isLoupeEnabled || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setLoupePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [isLoupeEnabled],
  );

  return {
    isLoupeEnabled,
    loupePos,
    containerRef,
    handleMouseMove,
    toggleLoupe,
  };
}
