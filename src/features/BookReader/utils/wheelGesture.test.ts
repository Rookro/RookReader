import type React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  toWheelSample,
  WheelGestureTracker,
  type WheelMove,
  type WheelSample,
} from "./wheelGesture";

const sample = (s: Partial<WheelSample> & { time: number; deltaY: number }): WheelSample => ({
  deltaX: 0,
  deltaMode: 0,
  wheelDeltaY: undefined,
  ...s,
});
const notch = (time: number, notches = 1, down = true) =>
  sample({
    time,
    deltaY: (down ? 100 : -100) * notches,
    wheelDeltaY: (down ? -120 : 120) * notches,
  });
// The touchpad's wheelDeltaY was measured at about three times deltaY.
const pad = (time: number, deltaY: number) =>
  sample({ time, deltaY, wheelDeltaY: -Math.round(3 * deltaY) });

// A measured single flick, as recorded (`t ms:deltaY`).
const FLICK = (
  "0:5.9 7:9 14:9.7 20:9.9 27:10 34:11 41:12.1 48:13.6 55:14.6 62:15.6 68:17.2 75:18.8 " +
  "82:19.5 89:20.6 96:21.3 103:21.5 110:21.9 117:21.9 124:22.7 130:10.7 137:9.9"
)
  .split(" ")
  .map((pair) => {
    const [t, d] = pair.split(":").map(Number);
    return pad(t, d);
  });

const run = (samples: WheelSample[], move = vi.fn<WheelMove>(() => true)) => {
  const tracker = new WheelGestureTracker();
  for (const s of samples) {
    tracker.handle(s, move);
  }
  return move.mock.calls;
};

describe("WheelGestureTracker", () => {
  it("turns one page per slow notch", () => {
    expect(run([notch(0), notch(844), notch(1365)])).toEqual([
      [1, 1, true],
      [1, 1, true],
      [1, 1, true],
    ]);
  });

  it("turns one page per notch at one line per notch", () => {
    const line = (time: number) => sample({ time, deltaY: 33.33, wheelDeltaY: -120 });
    expect(run([line(0), line(1351), line(2549)])).toEqual([
      [1, 1, true],
      [1, 1, true],
      [1, 1, true],
    ]);
  });

  it("turns one page per notch of a fast spin at one line per notch", () => {
    const line = (time: number) => sample({ time, deltaY: 33.33, wheelDeltaY: -120 });
    expect(run([line(0), line(15), line(30)])).toEqual([
      [1, 1, true],
      [1, 1, false],
      [1, 1, false],
    ]);
  });

  it("turns as many pages as a coalesced event holds", () => {
    const times = [0, 56, 69, 80, 93, 103, 116, 128, 142, 155];
    const counts = [1, 3, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(run(times.map((t, i) => notch(t, counts[i], false)))).toEqual([
      [-1, 1, true],
      [-1, 3, false],
      ...Array.from({ length: 8 }, () => [-1, 1, false]),
    ]);
  });

  it("turns nothing for a light swipe", () => {
    const swipe = Array.from({ length: 51 }, (_, i) => pad(i * 7, 0.5));
    expect(run([...swipe, sample({ time: 357, deltaY: -0.09, wheelDeltaY: 0 })])).toEqual([]);
  });

  it("turns one page per notch's worth of a flick", () => {
    expect(run(FLICK)).toEqual([
      [1, 1, true],
      [1, 1, false],
      [1, 1, false],
    ]);
    // The second turn comes on the 96 ms sample.
    expect(run(FLICK.slice(0, 15))).toHaveLength(2);
    expect(run(FLICK.slice(0, 14))).toHaveLength(1);
  });

  it("keeps a swipe's amount through a reverse blip", () => {
    const blipped = [...FLICK.slice(0, 9), pad(58, -0.09), ...FLICK.slice(9)];
    expect(run(blipped)).toEqual([
      [1, 1, true],
      [1, 1, false],
      [1, 1, false],
    ]);
  });

  it("turns back after a notch's worth of reverse movement", () => {
    expect(run([pad(0, 50), pad(7, -40), pad(14, -40), pad(21, -30)])).toEqual([[-1, 1, true]]);
  });

  it("clears the reverse amount when the swipe resumes", () => {
    expect(run([pad(0, 50), pad(7, -60), pad(14, 10), pad(21, -50)])).toEqual([]);
  });

  it("turns back at once on a reverse notch", () => {
    expect(run([notch(0), notch(10, 1, false)])).toEqual([
      [1, 1, true],
      [-1, 1, false],
    ]);
  });

  it("keeps turning back after a reverse turn", () => {
    expect(run([pad(0, 50), pad(7, -110), pad(14, 0.09), pad(21, -90)])).toEqual([
      [-1, 1, true],
      [-1, 1, false],
    ]);
  });

  it("a reverse turn drops the forward amount", () => {
    expect(run([pad(0, 50), pad(7, -110), pad(14, -85)])).toEqual([[-1, 1, true]]);
  });

  it("turns several pages for one large continuous event", () => {
    expect(run([pad(0, 250)])).toEqual([[1, 2, true]]);
  });

  it("drops the amount when the gesture ends", () => {
    expect(run([pad(0, 60), pad(100, 60)])).toEqual([]);
  });

  // The tracker is shared, so a swipe must not make later notches count as continuous.
  it("recognises notches again in a gesture after a swipe", () => {
    expect(run([pad(0, 30), sample({ time: 200, deltaY: 33.33, wheelDeltaY: -120 })])).toEqual([
      [1, 1, true],
    ]);
  });

  it("starts a new gesture after exactly the gap", () => {
    expect(run([notch(0), notch(100)])).toEqual([
      [1, 1, true],
      [1, 1, true],
    ]);
  });

  it("ignores sideways movement but keeps the gesture alive", () => {
    const samples = [
      notch(0),
      sample({ time: 60, deltaX: 30, deltaY: 2 }),
      sample({ time: 120, deltaY: 33.33, wheelDeltaY: -120 }),
    ];
    expect(run(samples)).toEqual([
      [1, 1, true],
      [1, 1, false],
    ]);
  });

  it("ignores events without vertical movement but keeps the gesture alive", () => {
    const samples = [
      notch(0),
      sample({ time: 60, deltaY: 0 }),
      sample({ time: 120, deltaY: 33.33, wheelDeltaY: -120 }),
    ];
    expect(run(samples)).toEqual([
      [1, 1, true],
      [1, 1, false],
    ]);
  });

  it("treats a 120 multiple as continuous once the gesture has seen continuous movement", () => {
    expect(run([pad(0, 30), sample({ time: 7, deltaY: 40, wheelDeltaY: -120 })])).toEqual([]);
  });

  it("counts a line-mode event as one notch even after continuous movement", () => {
    expect(run([pad(0, 10), sample({ time: 7, deltaY: 3, deltaMode: 1 })])).toEqual([[1, 1, true]]);
  });

  it("counts the notches a line-mode event holds", () => {
    expect(run([sample({ time: 0, deltaY: 6, deltaMode: 1, wheelDeltaY: -240 })])).toEqual([
      [1, 2, true],
    ]);
  });

  it("counts a page-mode event as one notch", () => {
    expect(run([sample({ time: 0, deltaY: 1, deltaMode: 2 })])).toEqual([[1, 1, true]]);
  });

  it("a notch drops the scroll amount", () => {
    const samples = [pad(0, 90), sample({ time: 7, deltaY: 3, deltaMode: 1 }), pad(14, 20)];
    expect(run(samples)).toEqual([[1, 1, true]]);
  });

  it("ignores the rest of a gesture once a move stays put", () => {
    const move = vi.fn<WheelMove>(() => false);
    expect(run([notch(0), notch(20), notch(40), notch(200)], move)).toEqual([
      [1, 1, true],
      [1, 1, true],
    ]);
  });

  it("lets a turn the other way lift a stop", () => {
    const move = vi.fn<WheelMove>((d) => d === -1);
    expect(run([notch(0), notch(20, 1, false), notch(40)], move)).toEqual([
      [1, 1, true],
      [-1, 1, false],
      [1, 1, false],
    ]);
  });

  it("lets continuous reverse movement lift a stop", () => {
    const move = vi.fn<WheelMove>((d) => d === -1);
    expect(run([notch(0), pad(10, -60), pad(20, -50), notch(30)], move)).toEqual([
      [1, 1, true],
      [-1, 1, false],
      [1, 1, false],
    ]);
  });

  it("does not let a reverse blip lift a stop", () => {
    const move = vi.fn<WheelMove>(() => false);
    expect(run([notch(0), pad(20, -0.5), notch(40)], move)).toEqual([[1, 1, true]]);
  });

  it("reset starts over", () => {
    const tracker = new WheelGestureTracker();
    const move = vi.fn<WheelMove>(() => false);
    tracker.handle(notch(0), move);
    tracker.reset();
    tracker.handle(notch(20), move);
    expect(move.mock.calls).toEqual([
      [1, 1, true],
      [1, 1, true],
    ]);
  });

  // A book opening from the wheel keeps loading after the gesture's pause would run out.
  it("a loading screen keeps a stopped gesture stopped", () => {
    const tracker = new WheelGestureTracker();
    tracker.handle(
      notch(0),
      vi.fn<WheelMove>(() => false),
    );
    tracker.hold(notch(60));
    tracker.hold(notch(120));
    tracker.hold(notch(180));
    const next = vi.fn<WheelMove>(() => true);
    tracker.handle(notch(240), next);
    tracker.handle(notch(400), next);
    expect(next.mock.calls).toEqual([[1, 1, true]]);
  });
});

describe("toWheelSample", () => {
  const wheel = (s: Record<string, unknown>) =>
    ({ deltaX: 0, deltaY: 0, deltaMode: 0, timeStamp: 0, ...s }) as unknown as WheelEvent;

  it("measures time on one clock across documents", () => {
    const a = { performance: { timeOrigin: 1000 } };
    const b = { performance: { timeOrigin: 2000 } };
    expect(toWheelSample(wheel({ deltaY: 1, timeStamp: 1010, view: a })).time).toBe(2010);
    expect(toWheelSample(wheel({ deltaY: 1, timeStamp: 60, view: b })).time).toBe(2060);
  });

  it("reads wheelDeltaY from a React event's native event", () => {
    // React's own event has no wheelDeltaY.
    const nativeEvent = wheel({ deltaY: 100, wheelDeltaY: -360 });
    const reactEvent = { deltaX: 0, deltaY: 100, deltaMode: 0, timeStamp: 0, nativeEvent };
    const s = toWheelSample(reactEvent as unknown as React.WheelEvent);
    expect(s.wheelDeltaY).toBe(-360);
  });

  it("has no wheelDeltaY when the engine sends none", () => {
    expect(toWheelSample(wheel({ deltaY: 5 })).wheelDeltaY).toBeUndefined();
  });
});
