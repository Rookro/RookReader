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
 * Whether a key press is part of an IME composition.
 *
 * @param e - A keydown event.
 * @returns `true` while the IME is composing, including WebKit's `keyCode` 229.
 */
export const isComposing = (e: KeyboardEvent): boolean => e.isComposing || e.keyCode === 229;

/**
 * Whether an event target is the top document's body or root element; another document's
 * (the EPUB iframe's) body does not count.
 *
 * @param target - The event target.
 * @returns `true` for `document.body` and `document.documentElement`.
 */
export const isTopDocumentRoot = (target: EventTarget | null): boolean =>
  target === document.body || target === document.documentElement;

/**
 * An open Dialog, Menu or Popover anywhere in `doc`; elements inside a hidden (keepMounted)
 * modal do not count.
 *
 * @param doc - The document to search.
 * @returns Whether a modal is open.
 */
export const isModalOpen = (doc: Document): boolean =>
  [...doc.querySelectorAll('[role="dialog"], [role="menu"], .MuiModal-root')].some(
    (el) => !el.closest(".MuiModal-hidden"),
  );
