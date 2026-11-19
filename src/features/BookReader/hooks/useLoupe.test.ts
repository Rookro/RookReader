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
    const { result } = renderHook(() => useLoupe());
    expect(result.current.isLoupeEnabled).toBe(false);
    expect(result.current.loupePos).toEqual({ x: 0, y: 0 });
    expect(result.current.containerRef.current).toBe(null);
  });

  it("should toggle loupe state manually", () => {
    const { result } = renderHook(() => useLoupe());
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

  it("should update loupe position on mouse move if enabled", () => {
    const { result } = renderHook(() => useLoupe());

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
    const { result } = renderHook(() => useLoupe());

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

  it("places the loupe at the pointer when a mouse button switches it on", () => {
    const { result } = renderHook(() => useLoupe());

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

    act(() => {
      result.current.toggleLoupe({ clientX: 50, clientY: 50 });
    });

    expect(result.current.isLoupeEnabled).toBe(true);
    expect(result.current.loupePos).toEqual({ x: 50, y: 50 });
  });
});
