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
