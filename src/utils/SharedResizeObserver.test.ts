import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeResize } from "./SharedResizeObserver";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  readonly observed = new Set<Element>();
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }

  /** Notifies the given targets, the way a real resize would. */
  fire(targets: Element[]) {
    const entries = targets.map((target) => ({ target }) as unknown as ResizeObserverEntry);
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

function sharedObserver(): ResizeObserverMock {
  const observer = ResizeObserverMock.instances.at(-1);
  if (!observer) throw new Error("no ResizeObserver was created");
  return observer;
}

describe("observeResize", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should notify only the callback registered for the resized element", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    const onFirst = vi.fn();
    const onSecond = vi.fn();

    const stopFirst = observeResize(first, onFirst);
    const stopSecond = observeResize(second, onSecond);

    sharedObserver().fire([first]);

    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onSecond).not.toHaveBeenCalled();

    stopFirst();
    stopSecond();
  });

  it("should reuse one observer for every element", () => {
    const before = ResizeObserverMock.instances.length;

    const stops = [
      observeResize(document.createElement("div"), vi.fn()),
      observeResize(document.createElement("div"), vi.fn()),
      observeResize(document.createElement("div"), vi.fn()),
    ];

    expect(ResizeObserverMock.instances.length).toBe(before);
    expect(sharedObserver().observed.size).toBe(3);

    for (const stop of stops) stop();
  });

  it("should stop observing and notifying once released", () => {
    const element = document.createElement("div");
    const onResize = vi.fn();

    const stop = observeResize(element, onResize);
    stop();

    expect(sharedObserver().observed.has(element)).toBe(false);

    sharedObserver().fire([element]);
    expect(onResize).not.toHaveBeenCalled();
  });

  it("should replace the callback when the same element is observed again", () => {
    const element = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();

    observeResize(element, first);
    const stop = observeResize(element, second);

    sharedObserver().fire([element]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    stop();
  });

  it("should be a no-op when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    const stop = observeResize(document.createElement("div"), vi.fn());

    expect(() => stop()).not.toThrow();
  });
});
