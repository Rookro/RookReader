import type { ErrorCode } from "../../../types/Error";
import type { ViewLayout } from "./ImageUtils";

/** The screen position a page slot occupies. Also its React key and alt-text lookup. */
export type SlotRole = "single" | "left" | "right";

/** Horizontal alignment of a page image within its slot. */
export type SlotAlign = "start" | "center" | "end";

/** One slot on screen: what page or error sits there, and where the reader lays it out. */
export interface PageSlot {
  /** Screen position (`single`, `left`, or `right`). */
  role: SlotRole;
  /** Archive/folder entry name of the page in this slot, when known. */
  entry?: string;
  /** Displayed image URL, once the page has loaded. */
  url?: string;
  /** Failure code when the page could not be loaded. */
  error?: ErrorCode;
  /** Left edge, as a fraction of the reader's width. */
  left: number;
  /** Width, as a fraction of the reader's width. */
  width: number;
  /** Horizontal alignment inside the slot (`start` = left, `end` = right). */
  align: SlotAlign;
}

/** Accessible `alt` text for each slot role. */
export const SLOT_ALT: Record<SlotRole, string> = {
  single: "Single Page",
  left: "Left Page",
  right: "Right Page",
};

/** CSS `object-position` matching each {@link SlotAlign}. */
export const OBJECT_POSITION: Record<SlotAlign, string> = {
  start: "left center",
  center: "center center",
  end: "right center",
};

/**
 * Resolves a {@link ViewLayout} into screen-order slots (left to right).
 *
 * Shared by the reader pane and the loupe canvas so the two cannot disagree on where
 * each page sits.
 *
 * @param layout The displayed layout.
 * @param direction Reading direction (`ltr` puts the first page on the left, `rtl` on the right).
 * @returns One slot for a single page, or two slots (`left`, `right`) for a spread.
 */
export const pageSlots = (layout: ViewLayout, direction: "ltr" | "rtl"): PageSlot[] => {
  const first = {
    entry: layout.firstEntry,
    url: layout.firstImage?.url,
    error: layout.firstError,
  };
  if (!layout.isSpread) {
    return [
      {
        role: "single",
        ...first,
        left: 0,
        width: 1,
        align: "center",
      },
    ];
  }
  const second = {
    entry: layout.secondEntry,
    url: layout.secondImage?.url,
    error: layout.secondError,
  };
  // The pair is in reading order, the screen is not: in RTL the first page is the right one.
  const [left, right] = direction === "ltr" ? [first, second] : [second, first];
  return [
    { role: "left", ...left, left: 0, width: 0.5, align: "end" },
    { role: "right", ...right, left: 0.5, width: 0.5, align: "start" },
  ];
};
