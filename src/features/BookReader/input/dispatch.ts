import { LIST_NAVIGATION_KEYS } from "../../../hooks/useListKeyboardNavigation";
import { isInSidePane } from "../../SidePane/sidePaneDom";
import {
  type CommonAction,
  findAction,
  type PageAction,
  REPEATABLE_ACTIONS,
  type ReaderAction,
  SIDE_PANE_BINDINGS,
} from "./bindings";
import { type Combo, comboOf, mouseButtonName, sameCombo } from "./combo";
import { isComposing, isModalOpen, isTextEntryTarget, isTopDocumentRoot } from "./guards";
import type { ReaderActions, ReaderInput } from "./types";

/** What the dispatcher needs to know about the reader when an input arrives. */
export interface DispatchContext {
  /** Whether the reader view, not the bookshelf, is shown. */
  isReaderActive: boolean;
  /** The open book's reading direction, which decides what the left and right keys do. */
  direction: "ltr" | "rtl";
  /** The comic loupe's toggle, or null when none is set. */
  loupeToggle: Combo | null;
  /** The active reader, or null while none is registered (a book loading). */
  reader: ReaderActions | null;
  /** The actions that do not depend on the active reader. */
  common: Record<CommonAction, () => void>;
  /** The side pane's state. */
  sidePane: {
    /** Whether the panels are hidden; the tab strip stays shown. */
    isHidden: boolean;
    /** Whether the keyboard is working in the side pane right now. */
    isKeyboardInPane: () => boolean;
    /** Refocuses the active panel after its focused element was lost. */
    recoverFocus: () => void;
  };
}

const NO_MODIFIERS = { ctrl: false, alt: false, shift: false, meta: false };

// A Record, so a new page action that is missing here fails to compile.
const PAGE_ACTIONS: Record<PageAction, true> = {
  pageLeft: true,
  pageRight: true,
  nextPage: true,
  previousPage: true,
  firstPage: true,
  lastPage: true,
};

const isPageAction = (action: ReaderAction): action is PageAction => action in PAGE_ACTIONS;

const runAction = (action: ReaderAction, { direction, reader, common }: DispatchContext): void => {
  if (!isPageAction(action)) {
    common[action]();
    return;
  }
  if (!reader) {
    return;
  }
  if (action === "firstPage" || action === "lastPage") {
    reader[action]();
    return;
  }
  // In right-to-left books the left side comes next.
  const forward =
    action === "nextPage" ||
    (action === "pageLeft" && direction === "rtl") ||
    (action === "pageRight" && direction === "ltr");
  if (forward) {
    reader.nextPage();
  } else {
    reader.previousPage();
  }
};

const dispatchSidePaneKey = (event: KeyboardEvent, combo: Combo, ctx: DispatchContext): boolean => {
  let action = findAction(combo, SIDE_PANE_BINDINGS);
  // The tab strip stays shown while the pane is hidden, and F6 there enters the pane.
  if (action === "focusReader" && combo.key === "F6" && ctx.sidePane.isHidden) {
    action = "focusSidePane";
  }
  if (!action) {
    // The focused element was lost: the key must not fall through to the page.
    if (
      isTopDocumentRoot(event.target) &&
      LIST_NAVIGATION_KEYS.has(event.key) &&
      !combo.ctrl &&
      !combo.alt &&
      !combo.meta
    ) {
      event.preventDefault();
      ctx.sidePane.recoverFocus();
      return true;
    }
    return false;
  }
  event.preventDefault();
  if (event.repeat && !REPEATABLE_ACTIONS.has(action)) {
    return true;
  }
  runAction(action, ctx);
  return true;
};

/**
 * Runs the action bound to an input.
 *
 * Keys and mouse buttons are ignored outside the reader view, while a modal is open, when a
 * component already handled them, and (keys only) during IME composition. A key pressed in the
 * side pane, or on the body while the keyboard is in the pane, runs only the side pane's
 * bindings, also from a text field. Any other key typed into a text field is ignored. The loupe
 * toggle wins over the reader's bindings where the loupe can act. A handled key or button gets
 * `preventDefault()`.
 *
 * @param input - The received input.
 * @param ctx - The reader's state when the input arrived.
 * @returns Whether the input was handled; for the wheel, whether the move went all the way.
 */
export const dispatchReaderInput = (input: ReaderInput, ctx: DispatchContext): boolean => {
  if (input.kind === "wheel") {
    if (!ctx.reader) {
      return false;
    }
    const move = input.direction > 0 ? ctx.reader.nextPage : ctx.reader.previousPage;
    return move({ steps: input.steps, crossBook: input.crossBook });
  }

  if (input.kind === "click") {
    const action = findAction({
      key: input.button === "left" ? "MouseLeft" : "MouseRight",
      ...NO_MODIFIERS,
    });
    if (!action) {
      return false;
    }
    runAction(action, ctx);
    return true;
  }

  const { event } = input;
  if (
    !ctx.isReaderActive ||
    event.defaultPrevented ||
    isModalOpen(document) ||
    (input.kind === "key" && isComposing(input.event))
  ) {
    return false;
  }
  const combo = comboOf(event);
  if (!combo) {
    return false;
  }

  if (input.kind === "key") {
    const target = input.event.target;
    const inPane =
      isInSidePane(target) || (isTopDocumentRoot(target) && ctx.sidePane.isKeyboardInPane());
    if (inPane) {
      return dispatchSidePaneKey(input.event, combo, ctx);
    }
    if (isTextEntryTarget(target)) {
      return false;
    }
  }

  const toggleLoupe = ctx.reader?.toggleLoupe;
  if (
    toggleLoupe &&
    ctx.loupeToggle &&
    sameCombo(combo, ctx.loupeToggle) &&
    (input.kind === "key" || input.inReadingArea)
  ) {
    if (input.kind === "button") {
      toggleLoupe({ clientX: input.event.clientX, clientY: input.event.clientY });
    } else {
      toggleLoupe();
    }
    event.preventDefault();
    return true;
  }

  const action = findAction(combo);
  if (!action) {
    return false;
  }
  event.preventDefault();
  if (input.kind === "key" && input.event.repeat && !REPEATABLE_ACTIONS.has(action)) {
    return true;
  }
  runAction(action, ctx);
  return true;
};

/**
 * Prevents the default of a back or forward button's `mouseup` or `auxclick`, on which the
 * webview runs its own history navigation; the press itself is handled on `mousedown`.
 *
 * @param e - A `mouseup` or `auxclick` event, possibly from an iframe's realm.
 */
export const preventSideButtonRelease = (e: MouseEvent): void => {
  const name = mouseButtonName(e.button);
  if (name === "MouseBack" || name === "MouseForward") {
    e.preventDefault();
  }
};
