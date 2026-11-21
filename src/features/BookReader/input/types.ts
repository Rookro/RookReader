import type { PageMove } from "../hooks/usePageNavigation";

/** Where the pointer was, in client coordinates. */
export interface PointerPosition {
  clientX: number;
  clientY: number;
}

/** What the active reader can do, registered with the reader input provider. */
export interface ReaderActions {
  nextPage: PageMove;
  previousPage: PageMove;
  /** Jumps to the start of the book, never to the previous book. */
  firstPage: () => void;
  /** Jumps to the end of the book, never to the next book. */
  lastPage: () => void;
  /** Only the comic reader has a loupe; `at` is set when a mouse button toggled it. */
  toggleLoupe?: (at?: PointerPosition) => void;
}

/** One received input, before it is matched against the bindings. */
export type ReaderInput =
  | { kind: "key"; event: KeyboardEvent }
  | { kind: "button"; event: MouseEvent; inReadingArea: boolean }
  | { kind: "click"; button: "left" | "right"; at: PointerPosition }
  | { kind: "wheel"; direction: 1 | -1; steps: number; crossBook: boolean };

/** What receivers use to hand an input to the dispatcher. */
export interface ReaderInputApi {
  /** Handled (key, button, click) or the move's result (wheel). */
  dispatchInput: (input: ReaderInput) => boolean;
}
