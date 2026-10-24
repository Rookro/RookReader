import type React from "react";

/** A pause this long between wheel events, in ms, ends a wheel gesture. */
export const WHEEL_GESTURE_GAP_MS = 100;

/** `deltaY` of touchpad movement that turns one page: one mouse-wheel notch's scroll. */
export const WHEEL_NOTCH_DELTA = 100;

/** `wheelDeltaY` of one mouse-wheel notch. */
export const WHEEL_DELTA_PER_NOTCH = 120;

/** One wheel event, reduced to what page turning needs. */
export interface WheelSample {
  /** Input time in ms on a clock shared by every document (time origin + `timeStamp`). */
  time: number;
  /** Horizontal movement. */
  deltaX: number;
  /** Vertical movement; positive is down. */
  deltaY: number;
  /** The unit of the deltas: 0 pixels, 1 lines, 2 pages. */
  deltaMode: number;
  /** Non-standard; ±120 per wheel notch. Undefined when the engine has none. */
  wheelDeltaY: number | undefined;
}

/**
 * Turns `steps` pages in `direction` (1 forward, -1 back); `crossBook` lets a move at the
 * first or last page go on to the adjacent book.
 *
 * @returns False when it stopped short: at the first or last page, or by handing off to
 *   the adjacent book.
 */
export type WheelMove = (direction: 1 | -1, steps: number, crossBook: boolean) => boolean;

/**
 * Turns wheel events into page turns: one page per mouse-wheel notch, and one page per
 * notch's worth of touchpad movement within a gesture. A gesture stops at the first or
 * last page, and only its first turn may go on to the adjacent book.
 */
export class WheelGestureTracker {
  #lastTime: number | null = null;
  #continuousSeen = false;
  /** Direction of the gesture's movement; 0 before any. */
  #direction: 0 | 1 | -1 = 0;
  #amount = 0;
  #reverseAmount = 0;
  #turned = false;
  /** Direction in which the gesture stopped; 0 when it has not. */
  #stopped: 0 | 1 | -1 = 0;

  /**
   * Handles one wheel event.
   *
   * @param sample - The event.
   * @param move - Turns the pages the event asks for.
   */
  handle(sample: WheelSample, move: WheelMove): void {
    if (this.#lastTime === null || sample.time - this.#lastTime >= WHEEL_GESTURE_GAP_MS) {
      this.reset();
    }
    this.#lastTime = sample.time;
    // Mostly sideways movement turns nothing but still continues the gesture.
    if (sample.deltaY === 0 || Math.abs(sample.deltaX) > Math.abs(sample.deltaY)) {
      return;
    }
    const direction = sample.deltaY > 0 ? 1 : -1;
    const notches = this.#notches(sample);
    if (notches > 0) {
      this.#amount = 0;
      this.#reverseAmount = 0;
      this.#direction = direction;
      this.#turn(direction, notches, move);
      return;
    }
    this.#continuousSeen = true;
    if (this.#direction === 0) {
      this.#direction = direction;
    }
    const delta = Math.abs(sample.deltaY);
    if (direction === this.#direction) {
      this.#amount += delta;
      this.#reverseAmount = 0;
      const pages = Math.floor(this.#amount / WHEEL_NOTCH_DELTA);
      if (pages > 0) {
        this.#amount -= pages * WHEEL_NOTCH_DELTA;
        this.#turn(direction, pages, move);
      }
      return;
    }
    // Movement the other way counts separately, so a blip keeps the swipe's amount.
    this.#reverseAmount += delta;
    const pages = Math.floor(this.#reverseAmount / WHEEL_NOTCH_DELTA);
    if (pages > 0) {
      this.#direction = direction;
      this.#amount = this.#reverseAmount - pages * WHEEL_NOTCH_DELTA;
      this.#reverseAmount = 0;
      this.#turn(direction, pages, move);
    }
  }

  /**
   * Handles a wheel event over a screen that cannot turn pages, such as a book loading:
   * it continues the gesture, so the rest of a spin does nothing in the book that opens.
   *
   * @param sample - The event.
   */
  hold(sample: WheelSample): void {
    this.handle(sample, () => false);
  }

  /** Forgets the current gesture. */
  reset(): void {
    this.#lastTime = null;
    this.#continuousSeen = false;
    this.#direction = 0;
    this.#amount = 0;
    this.#reverseAmount = 0;
    this.#turned = false;
    this.#stopped = 0;
  }

  #notches(sample: WheelSample): number {
    const w = sample.wheelDeltaY;
    const ticks =
      w !== undefined && w !== 0 && w % WHEEL_DELTA_PER_NOTCH === 0
        ? Math.abs(w) / WHEEL_DELTA_PER_NOTCH
        : 0;
    // Only notched wheels send line or page deltas.
    if (sample.deltaMode !== 0) {
      return Math.max(ticks, 1);
    }
    return this.#continuousSeen ? 0 : ticks;
  }

  #turn(direction: 1 | -1, steps: number, move: WheelMove): void {
    if (this.#stopped === direction) {
      return;
    }
    // Only a gesture's first turn may go on to the adjacent book.
    const moved = move(direction, steps, !this.#turned);
    this.#turned = true;
    this.#stopped = moved ? 0 : direction;
  }
}

/** The tracker every reader shares, so a gesture outlives the reader that started it. */
export const wheelGesture = new WheelGestureTracker();

/**
 * Reduces a React or native wheel event to a {@link WheelSample}.
 *
 * @param e - The event; a novel's events come natively from the book's iframe.
 * @returns The sample, timed on the clock shared by every document.
 */
export function toWheelSample(e: React.WheelEvent | WheelEvent): WheelSample {
  const native = "nativeEvent" in e ? e.nativeEvent : e;
  return {
    time: (native.view?.performance.timeOrigin ?? performance.timeOrigin) + native.timeStamp,
    deltaX: native.deltaX,
    deltaY: native.deltaY,
    deltaMode: native.deltaMode,
    wheelDeltaY:
      "wheelDeltaY" in native && typeof native.wheelDeltaY === "number"
        ? native.wheelDeltaY
        : undefined,
  };
}

/**
 * Wheel handler for screens that cannot turn pages, such as a book loading.
 *
 * @param e - The wheel event.
 */
export function holdWheelGesture(e: React.WheelEvent): void {
  wheelGesture.hold(toWheelSample(e));
}
