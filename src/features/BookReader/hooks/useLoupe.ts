import { useCallback, useEffect, useRef, useState } from "react";

export function useLoupe(toggleKey?: string) {
  const [isLoupeEnabled, setIsLoupeEnabled] = useState(false);
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleLoupe = useCallback(() => {
    setIsLoupeEnabled((prev) => !prev);
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!toggleKey) {
        return;
      }

      const parts = toggleKey.split("+");
      const keyComboLast = parts[parts.length - 1];

      let buttonName = "";
      if (e.button === 1) {
        buttonName = "MouseMiddle";
      } else if (e.button === 3) {
        buttonName = "MouseBack";
      } else if (e.button === 4) {
        buttonName = "MouseForward";
      }

      if (!buttonName) {
        return;
      }

      const needsCtrl = parts.includes("Ctrl");
      const needsAlt = parts.includes("Alt");
      const needsShift = parts.includes("Shift");
      const needsMeta = parts.includes("Meta");

      if (
        buttonName === keyComboLast &&
        e.ctrlKey === needsCtrl &&
        e.altKey === needsAlt &&
        e.shiftKey === needsShift &&
        e.metaKey === needsMeta
      ) {
        e.preventDefault(); // Prevent default browser action
        setIsLoupeEnabled((prev) => {
          const nextState = !prev;
          if (nextState && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setLoupePos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }
          return nextState;
        });
      }
    },
    [toggleKey],
  );

  useEffect(() => {
    if (!toggleKey) {
      return;
    }

    const parts = toggleKey.split("+");
    const keyComboLast = parts[parts.length - 1];
    const keyComboKey = keyComboLast === "Space" ? " " : keyComboLast.toLowerCase();

    const needsCtrl = parts.includes("Ctrl");
    const needsAlt = parts.includes("Alt");
    const needsShift = parts.includes("Shift");
    const needsMeta = parts.includes("Meta");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === keyComboKey &&
        e.ctrlKey === needsCtrl &&
        e.altKey === needsAlt &&
        e.shiftKey === needsShift &&
        e.metaKey === needsMeta
      ) {
        setIsLoupeEnabled((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleKey]);

  return {
    isLoupeEnabled,
    loupePos,
    containerRef,
    handleMouseMove,
    handleMouseDown,
    toggleLoupe,
  };
}
