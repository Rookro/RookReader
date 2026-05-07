import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoupe } from "./useLoupe";

describe("useLoupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useLoupe("l"));
    expect(result.current.isLoupeEnabled).toBe(false);
    expect(result.current.loupePos).toEqual({ x: 0, y: 0 });
    expect(result.current.containerRef.current).toBe(null);
  });

  it("should toggle loupe state manually", () => {
    const { result } = renderHook(() => useLoupe("l"));
    expect(result.current.isLoupeEnabled).toBe(false);

    act(() => {
      result.current.toggleLoupe();
    });
    expect(result.current.isLoupeEnabled).toBe(true);

    act(() => {
      result.current.toggleLoupe();
    });
    expect(result.current.isLoupeEnabled).toBe(false);
  });

  it("should toggle loupe on valid keyboard shortcut", () => {
    const { result } = renderHook(() => useLoupe("l"));
    expect(result.current.isLoupeEnabled).toBe(false);

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "l",
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });
      window.dispatchEvent(event);
    });
    expect(result.current.isLoupeEnabled).toBe(true);
  });

  it("should handle complex keyboard shortcut", () => {
    const { result } = renderHook(() => useLoupe("Ctrl+Shift+L"));

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "l",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
      window.dispatchEvent(event);
    });
    expect(result.current.isLoupeEnabled).toBe(true);

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "l",
        ctrlKey: true, // missing shiftKey, shouldn't toggle
        shiftKey: false,
        altKey: false,
        metaKey: false,
      });
      window.dispatchEvent(event);
    });
    expect(result.current.isLoupeEnabled).toBe(true); // remains true
  });

  it("should handle Space key shortcut", () => {
    const { result } = renderHook(() => useLoupe("Space"));

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: " ",
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });
      window.dispatchEvent(event);
    });
    expect(result.current.isLoupeEnabled).toBe(true);
  });

  it("should NOT close loupe with Escape key", () => {
    const { result } = renderHook(() => useLoupe("l"));

    act(() => {
      // Open first
      const event = new KeyboardEvent("keydown", {
        key: "l",
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });
      window.dispatchEvent(event);
    });
    expect(result.current.isLoupeEnabled).toBe(true);

    act(() => {
      // Press Escape
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);
    });
    // Should still be enabled
    expect(result.current.isLoupeEnabled).toBe(true);
  });

  it("should update loupe position on mouse move if enabled", () => {
    const { result } = renderHook(() => useLoupe("l"));

    // Create a mock ref element with getBoundingClientRect
    const mockElement = document.createElement("div");
    mockElement.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 100,
      bottom: 120,
      right: 110,
      x: 10,
      y: 20,
      toJSON: () => {},
    });

    // We can't directly mutate containerRef.current in React strict mode hooks typically without trickery,
    // but in testing we can cast it
    result.current.containerRef.current = mockElement;

    // Enable loupe first
    act(() => {
      result.current.toggleLoupe();
    });

    act(() => {
      const mockMouseEvent = { clientX: 50, clientY: 60 } as React.MouseEvent;
      result.current.handleMouseMove(mockMouseEvent);
    });

    expect(result.current.loupePos).toEqual({ x: 40, y: 40 });
  });

  it("should not update loupe position on mouse move if disabled", () => {
    const { result } = renderHook(() => useLoupe("l"));

    const mockElement = document.createElement("div");
    mockElement.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 100,
      bottom: 120,
      right: 110,
      x: 10,
      y: 20,
      toJSON: () => {},
    });
    result.current.containerRef.current = mockElement;

    act(() => {
      const mockMouseEvent = { clientX: 50, clientY: 60 } as React.MouseEvent;
      result.current.handleMouseMove(mockMouseEvent);
    });

    expect(result.current.loupePos).toEqual({ x: 0, y: 0 });
  });

  it("should handle mouse down shortcut to toggle and call preventDefault", () => {
    const { result } = renderHook(() => useLoupe("Ctrl+MouseMiddle"));

    const mockElement = document.createElement("div");
    mockElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    result.current.containerRef.current = mockElement;

    const preventDefault = vi.fn();
    act(() => {
      const mockEvent = {
        button: 1, // MouseMiddle
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        clientX: 50,
        clientY: 50,
        preventDefault,
      } as unknown as React.MouseEvent;
      result.current.handleMouseDown(mockEvent);
    });

    expect(result.current.isLoupeEnabled).toBe(true);
    expect(result.current.loupePos).toEqual({ x: 50, y: 50 });
    expect(preventDefault).toHaveBeenCalled();
  });

  it("should do nothing on mouse down if toggleKey is missing", () => {
    const { result } = renderHook(() => useLoupe(undefined));

    act(() => {
      const mockEvent = {
        button: 1,
        clientX: 50,
        clientY: 50,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;
      result.current.handleMouseDown(mockEvent);
    });

    expect(result.current.isLoupeEnabled).toBe(false);
  });
});
