import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDragDropEvent } from "./useDragDropEvent";
import { getCurrentWindow } from "@tauri-apps/api/window";

describe("useDragDropEvent", () => {
  const onDrag = vi.fn();
  const onDrop = vi.fn();
  const onLeave = vi.fn();
  const mockUnlisten = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that drag-and-drop listener is correctly setup and events (enter, drop, leave) are handled properly
  it("should setup drag-and-drop listener and handle events", async () => {
    let eventHandler:
      | Parameters<ReturnType<typeof getCurrentWindow>["onDragDropEvent"]>[0]
      | undefined;
    const mockWindow = {
      onDragDropEvent: vi.fn((handler) => {
        eventHandler = handler;
        return Promise.resolve(mockUnlisten);
      }),
    };
    vi.mocked(getCurrentWindow).mockReturnValue(
      mockWindow as unknown as ReturnType<typeof getCurrentWindow>,
    );

    renderHook(() => useDragDropEvent({ onDrag, onDrop, onLeave }));

    expect(mockWindow.onDragDropEvent).toHaveBeenCalled();

    // Simulate drag enter
    eventHandler?.({ payload: { type: "enter" } } as Parameters<
      Parameters<ReturnType<typeof getCurrentWindow>["onDragDropEvent"]>[0]
    >[0]);
    expect(onDrag).toHaveBeenCalled();

    // Simulate drop
    eventHandler?.({ payload: { type: "drop", paths: ["/path/1"] } } as Parameters<
      Parameters<ReturnType<typeof getCurrentWindow>["onDragDropEvent"]>[0]
    >[0]);
    expect(onDrop).toHaveBeenCalledWith(["/path/1"]);

    // Simulate leave
    eventHandler?.({ payload: { type: "leave" } } as Parameters<
      Parameters<ReturnType<typeof getCurrentWindow>["onDragDropEvent"]>[0]
    >[0]);
    expect(onLeave).toHaveBeenCalled();
  });
});
