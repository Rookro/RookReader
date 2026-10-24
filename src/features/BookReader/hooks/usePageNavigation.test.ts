import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { wheelGesture } from "../utils/wheelGesture";
import { type PageMove, usePageNavigation } from "./usePageNavigation";

describe("usePageNavigation", () => {
  const onMoveForward = vi.fn<PageMove>(() => true);
  const onMoveBack = vi.fn<PageMove>(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
    wheelGesture.reset();
  });

  // Verify that onMoveForward is called on click
  it("should call onMoveForward when clicked", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    result.current.handleClicked({} as MouseEvent);
    expect(onMoveForward).toHaveBeenCalledWith();
  });

  // Verify that onMoveBack is called and default behavior is prevented when context menu is triggered
  it("should call onMoveBack and preventDefault when context menu is triggered", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
    result.current.handleContextMenu(mockEvent);
    expect(onMoveBack).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  const wheel = (s: Record<string, unknown>) =>
    ({ deltaX: 0, deltaMode: 0, timeStamp: 0, ...s }) as unknown as WheelEvent;

  it("turns one page forward for a notch down", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120 }));
    expect(onMoveForward).toHaveBeenCalledWith({ steps: 1, crossBook: true });
  });

  it("turns one page back for a notch up", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    result.current.handleWheeled(wheel({ deltaY: -100, wheelDeltaY: 120 }));
    expect(onMoveBack).toHaveBeenCalledWith({ steps: 1, crossBook: true });
  });

  it("passes a coalesced event's pages and a single crossing on to the move", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    result.current.handleWheeled(wheel({ deltaY: 200, wheelDeltaY: -240, timeStamp: 0 }));
    result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 10 }));
    expect(onMoveForward.mock.calls).toEqual([
      [{ steps: 2, crossBook: true }],
      [{ steps: 1, crossBook: false }],
    ]);
  });

  // The reader remounts when the next book opens, and the rest of the spin must not turn it.
  it("keeps a stopped gesture stopped across a remount", () => {
    const stay = vi.fn<PageMove>(() => false);
    const first = renderHook(() => usePageNavigation(stay, onMoveBack, "ltr"));
    first.result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 0 }));
    first.unmount();
    const second = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    second.result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 50 }));
    expect(onMoveForward).not.toHaveBeenCalled();
    second.result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 200 }));
    expect(onMoveForward).toHaveBeenCalledWith({ steps: 1, crossBook: true });
  });

  describe("Keyboard Navigation (ltr)", () => {
    // Verify that onMoveBack is called in LTR mode when the left arrow key is pressed
    it("should call onMoveBack when ArrowLeft is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
      const mockEvent = { key: "ArrowLeft" } as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveBack).toHaveBeenCalled();
    });

    // Verify that onMoveForward is called in LTR mode when the right arrow key is pressed
    it("should call onMoveForward when ArrowRight is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
      const mockEvent = { key: "ArrowRight" } as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveForward).toHaveBeenCalled();
    });
  });

  describe("Keyboard Navigation (rtl)", () => {
    // Verify that onMoveForward is called in RTL mode when the left arrow key is pressed
    it("should call onMoveForward when ArrowLeft is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "rtl"));
      const mockEvent = { key: "ArrowLeft" } as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveForward).toHaveBeenCalled();
    });

    // Verify that onMoveBack is called in RTL mode when the right arrow key is pressed
    it("should call onMoveBack when ArrowRight is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "rtl"));
      const mockEvent = { key: "ArrowRight" } as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveBack).toHaveBeenCalled();
    });

    // Verify that nothing is called when other keys are pressed
    it("should do nothing for other keys", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
      const mockEvent = { key: "Enter" } as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveForward).not.toHaveBeenCalled();
      expect(onMoveBack).not.toHaveBeenCalled();
    });
  });
});
