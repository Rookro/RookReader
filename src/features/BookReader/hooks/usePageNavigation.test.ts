import { renderHook } from "@testing-library/react";
import type React from "react";
import { createElement, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../../test/utils";
import { dispatchReaderInput } from "../input/dispatch";
import { ReaderInputProvider, useRegisterReaderActions } from "../input/ReaderInputContext";
import { wheelGesture } from "../utils/wheelGesture";
import { type PageMove, usePageNavigation } from "./usePageNavigation";

vi.mock("../input/dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../input/dispatch")>();
  return { ...actual, dispatchReaderInput: vi.fn(actual.dispatchReaderInput) };
});

describe("usePageNavigation", () => {
  const onMoveForward = vi.fn<PageMove>(() => true);
  const onMoveBack = vi.fn<PageMove>(() => true);

  /** The hook in a reading area whose reader moves with `forward` and `onMoveBack`. */
  const renderNavigation = (forward: PageMove = onMoveForward) => {
    const Providers = createTestWrapper();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(Providers, null, createElement(ReaderInputProvider, null, children));
    return renderHook(
      () => {
        const area = useRef<HTMLElement>(null);
        useRegisterReaderActions(
          { nextPage: forward, previousPage: onMoveBack, firstPage: vi.fn(), lastPage: vi.fn() },
          area,
        );
        return usePageNavigation();
      },
      { wrapper },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    wheelGesture.reset();
  });

  // Verify that onMoveForward is called on click
  it("should call onMoveForward when clicked", () => {
    const { result } = renderNavigation();
    result.current.handleClicked({} as MouseEvent);
    expect(onMoveForward).toHaveBeenCalledWith();
  });

  it("hands a click to the dispatcher at the event's position", () => {
    const { result } = renderNavigation();
    result.current.handleClicked({ clientX: 5, clientY: 6 } as MouseEvent);
    expect(dispatchReaderInput).toHaveBeenCalledWith(
      { kind: "click", button: "left", at: { clientX: 5, clientY: 6 } },
      expect.anything(),
    );
  });

  it("hands a click to the dispatcher at the given position", () => {
    const { result } = renderNavigation();
    result.current.handleClicked({ clientX: 5, clientY: 6 } as MouseEvent, {
      clientX: 70,
      clientY: 1,
    });
    expect(dispatchReaderInput).toHaveBeenCalledWith(
      { kind: "click", button: "left", at: { clientX: 70, clientY: 1 } },
      expect.anything(),
    );
  });

  // Verify that onMoveBack is called and default behavior is prevented when context menu is triggered
  it("should call onMoveBack and preventDefault when context menu is triggered", () => {
    const { result } = renderNavigation();
    const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
    result.current.handleContextMenu(mockEvent);
    expect(onMoveBack).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  const wheel = (s: Record<string, unknown>) =>
    ({ deltaX: 0, deltaMode: 0, timeStamp: 0, ...s }) as unknown as WheelEvent;

  it("turns one page forward for a notch down", () => {
    const { result } = renderNavigation();
    result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120 }));
    expect(onMoveForward).toHaveBeenCalledWith({ steps: 1, crossBook: true });
  });

  it("turns one page back for a notch up", () => {
    const { result } = renderNavigation();
    result.current.handleWheeled(wheel({ deltaY: -100, wheelDeltaY: 120 }));
    expect(onMoveBack).toHaveBeenCalledWith({ steps: 1, crossBook: true });
  });

  it("passes a coalesced event's pages and a single crossing on to the move", () => {
    const { result } = renderNavigation();
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
    const first = renderNavigation(stay);
    first.result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 0 }));
    first.unmount();
    const second = renderNavigation();
    second.result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 50 }));
    expect(onMoveForward).not.toHaveBeenCalled();
    second.result.current.handleWheeled(wheel({ deltaY: 100, wheelDeltaY: -120, timeStamp: 200 }));
    expect(onMoveForward).toHaveBeenCalledWith({ steps: 1, crossBook: true });
  });
});
