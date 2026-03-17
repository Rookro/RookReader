import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageNavigation } from "./usePageNavigation";

describe("usePageNavigation", () => {
  const onMoveForward = vi.fn();
  const onMoveBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that onMoveForward is called on click
  it("should call onMoveForward when clicked", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    result.current.handleClicked({} as MouseEvent);
    expect(onMoveForward).toHaveBeenCalled();
  });

  // Verify that onMoveBack is called and default behavior is prevented when context menu is triggered
  it("should call onMoveBack and preventDefault when context menu is triggered", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
    result.current.handleContextMenu(mockEvent);
    expect(onMoveBack).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  // Verify that onMoveForward is called when mouse wheel is scrolled down
  it("should call onMoveForward when wheel scrolled down", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    const mockEvent = { deltaY: 10 } as unknown as WheelEvent;
    result.current.handleWheeled(mockEvent);
    expect(onMoveForward).toHaveBeenCalled();
  });

  // Verify that onMoveBack is called when mouse wheel is scrolled up
  it("should call onMoveBack when wheel scrolled up", () => {
    const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
    const mockEvent = { deltaY: -10 } as unknown as WheelEvent;
    result.current.handleWheeled(mockEvent);
    expect(onMoveBack).toHaveBeenCalled();
  });

  describe("Keyboard Navigation (ltr)", () => {
    // Verify that onMoveBack is called in LTR mode when the left arrow key is pressed
    it("should call onMoveBack when ArrowLeft is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
      const mockEvent = { key: "ArrowLeft" } as unknown as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveBack).toHaveBeenCalled();
    });

    // Verify that onMoveForward is called in LTR mode when the right arrow key is pressed
    it("should call onMoveForward when ArrowRight is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
      const mockEvent = { key: "ArrowRight" } as unknown as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveForward).toHaveBeenCalled();
    });
  });

  describe("Keyboard Navigation (rtl)", () => {
    // Verify that onMoveForward is called in RTL mode when the left arrow key is pressed
    it("should call onMoveForward when ArrowLeft is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "rtl"));
      const mockEvent = { key: "ArrowLeft" } as unknown as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveForward).toHaveBeenCalled();
    });

    // Verify that onMoveBack is called in RTL mode when the right arrow key is pressed
    it("should call onMoveBack when ArrowRight is pressed", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "rtl"));
      const mockEvent = { key: "ArrowRight" } as unknown as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveBack).toHaveBeenCalled();
    });

    // Verify that nothing is called when other keys are pressed
    it("should do nothing for other keys", () => {
      const { result } = renderHook(() => usePageNavigation(onMoveForward, onMoveBack, "ltr"));
      const mockEvent = { key: "Enter" } as unknown as KeyboardEvent;
      result.current.handleKeydown(mockEvent);
      expect(onMoveForward).not.toHaveBeenCalled();
      expect(onMoveBack).not.toHaveBeenCalled();
    });
  });
});
