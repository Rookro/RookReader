import { vi } from "vitest";

/** Fake 2D canvas context with spies for the operations the loupe performs. */
export interface FakeCanvasContext {
  drawImage: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
}

/** Mutable bounds used to stub `getBoundingClientRect` on the reader container. */
export interface MutableRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Handles for the jsdom stubs installed for loupe tests. */
export interface LensStubs {
  ctx: FakeCanvasContext;
  rafSpy: ReturnType<typeof vi.spyOn>;
  cancelRafSpy: ReturnType<typeof vi.spyOn>;
  flushFrame: () => void;
  pendingFrameIds: () => number[];
  triggerResize: () => void;
  mockReaderRect: (
    element: Element,
    initial?: MutableRect,
  ) => {
    rect: MutableRect;
    spy: ReturnType<typeof vi.spyOn>;
  };
  restore: () => void;
}

/**
 * Installs jsdom stubs for the canvas context, animation frames, image natural size,
 * `ResizeObserver`, and `window.devicePixelRatio`. Call `restore()` in `afterEach`.
 */
export function installLensStubs(): LensStubs {
  const ctx: FakeCanvasContext = {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "2d"
      ? (ctx as unknown as CanvasRenderingContext2D)
      : null) as HTMLCanvasElement["getContext"]);

  let nextFrameId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextFrameId++;
    pending.set(id, cb);
    return id;
  });
  const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    pending.delete(id);
  });

  const flushFrame = () => {
    const queued = [...pending.values()];
    pending.clear();
    for (const cb of queued) {
      cb(performance.now());
    }
  };

  const pendingFrameIds = () => [...pending.keys()];

  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(800);
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);

  const originalResizeObserver = global.ResizeObserver;
  let resizeCallback: ResizeObserverCallback | null = null;
  let resizeObserverInstance: ResizeObserver | null = null;
  global.ResizeObserver = class StubResizeObserver implements ResizeObserver {
    constructor(cb: ResizeObserverCallback) {
      resizeCallback = cb;
      resizeObserverInstance = this;
    }
    observe() {}
    unobserve() {}
    disconnect() {
      if (resizeObserverInstance === this) {
        resizeCallback = null;
        resizeObserverInstance = null;
      }
    }
  };

  const triggerResize = () => {
    if (resizeCallback && resizeObserverInstance) {
      resizeCallback([], resizeObserverInstance);
    }
  };

  const originalDprDescriptor = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    writable: true,
    value: 2,
  });

  const mockReaderRect = (
    element: Element,
    initial: MutableRect = { left: 100, top: 50, width: 1000, height: 800 },
  ) => {
    const rect: MutableRect = { ...initial };
    const spy = vi.spyOn(element, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.left + rect.width,
          bottom: rect.top + rect.height,
          x: rect.left,
          y: rect.top,
          toJSON: () => {},
        }) as DOMRect,
    );
    return { rect, spy };
  };

  const restore = () => {
    global.ResizeObserver = originalResizeObserver;
    if (originalDprDescriptor) {
      Object.defineProperty(window, "devicePixelRatio", originalDprDescriptor);
    } else {
      Reflect.deleteProperty(window, "devicePixelRatio");
    }
    vi.restoreAllMocks();
  };

  return {
    ctx,
    rafSpy,
    cancelRafSpy,
    flushFrame,
    pendingFrameIds,
    triggerResize,
    mockReaderRect,
    restore,
  };
}
