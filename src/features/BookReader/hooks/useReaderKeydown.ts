import { useEffect } from "react";
import { useAppSelector } from "../../../store/store";

/**
 * Whether a key press is being typed into a field rather than sent to the reader.
 *
 * @param target - The event target.
 * @returns `true` for inputs, text areas and content-editable elements.
 */
export const isTextEntryTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return (
    element?.tagName === "INPUT" ||
    element?.tagName === "TEXTAREA" ||
    element?.isContentEditable === true
  );
};

/**
 * Listens for key presses meant for the reader.
 *
 * The reader stays mounted behind the bookshelf, so a plain window listener would turn
 * pages while the user navigates the bookshelf grid. The listener is attached only while
 * the reader view is active, and a press typed into a field is never delivered.
 *
 * @param handler - Called with each key press meant for the reader.
 */
export const useReaderKeydown = (handler: (e: KeyboardEvent) => void) => {
  const activeView = useAppSelector((state) => state.view.activeView);

  useEffect(() => {
    if (activeView !== "reader") {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextEntryTarget(e.target)) {
        return;
      }
      handler(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeView, handler]);
};
