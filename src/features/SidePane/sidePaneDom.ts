/** Marks the side pane's tab strip and panels container in the DOM. */
export const SIDE_PANE_ATTRIBUTE = "data-side-pane";

const MODAL_SELECTOR = '.MuiModal-root, [role="dialog"], [role="menu"]';

/**
 * Whether an event target is inside the side pane (its tab strip or its panels).
 *
 * @param target - An event target, possibly from an iframe's realm.
 * @returns `true` inside an element carrying {@link SIDE_PANE_ATTRIBUTE}.
 */
export const isInSidePane = (target: EventTarget | null): boolean =>
  typeof (target as Element | null)?.closest === "function" &&
  (target as Element).closest(`[${SIDE_PANE_ATTRIBUTE}]`) !== null;

/**
 * Whether an element is inside an open menu, dialog or popover, which MUI renders in a portal
 * under `body`, outside the side pane.
 *
 * @param element - The element that received focus.
 * @returns `true` inside a modal.
 */
export const isInOpenModal = (element: Element): boolean =>
  element.closest(MODAL_SELECTOR) !== null;
