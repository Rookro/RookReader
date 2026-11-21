import { getCurrentWindow } from "@tauri-apps/api/window";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDragDropEvent } from "./useDragDropEvent";

type DragDropHandler = Parameters<ReturnType<typeof getCurrentWindow>["onDragDropEvent"]>[0];
type DragDropEvent = Parameters<DragDropHandler>[0];

describe("useDragDropEvent", () => {
  const onDrag = vi.fn();
  const onDrop = vi.fn();
  const onLeave = vi.fn();
  const mockUnlisten = vi.fn();
  let eventHandler: DragDropHandler | undefined;
  const mockWindow = {
    onDragDropEvent: vi.fn((handler: DragDropHandler) => {
      eventHandler = handler;
      return Promise.resolve(mockUnlisten);
    }),
  };

  /** Sends a drag-drop event to the latest listener, like the window does. */
  const send = (payload: { type: "enter" | "over" | "drop" | "leave"; paths?: string[] }) =>
    eventHandler?.({
      payload: { position: { x: 0, y: 0 }, ...payload },
    } as unknown as DragDropEvent);

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandler = undefined;
    vi.mocked(getCurrentWindow).mockReturnValue(
      mockWindow as unknown as ReturnType<typeof getCurrentWindow>,
    );
  });

  // Verify that drag-and-drop listener is correctly setup and events (enter, drop, leave) are handled properly
  it("should setup drag-and-drop listener and handle events", async () => {
    renderHook(() => useDragDropEvent({ onDrag, onDrop, onLeave }));

    expect(mockWindow.onDragDropEvent).toHaveBeenCalled();

    send({ type: "enter", paths: ["/path/1"] });
    expect(onDrag).toHaveBeenCalled();

    send({ type: "drop", paths: ["/path/1"] });
    expect(onDrop).toHaveBeenCalledWith(["/path/1"]);

    send({ type: "leave" });
    expect(onLeave).toHaveBeenCalled();
  });

  it("ignores an in-app drag that sends over and an empty drop without enter", () => {
    renderHook(() => useDragDropEvent({ onDrag, onDrop, onLeave }));

    send({ type: "over" });
    send({ type: "drop", paths: [] });

    expect(onDrag).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("ignores a drag that enters without files", () => {
    renderHook(() => useDragDropEvent({ onDrag, onDrop, onLeave }));

    send({ type: "enter", paths: [] });
    send({ type: "over" });

    expect(onDrag).not.toHaveBeenCalled();
  });

  it("ignores an in-app drag after a file drop", () => {
    renderHook(() => useDragDropEvent({ onDrag, onDrop, onLeave }));
    send({ type: "enter", paths: ["/a.zip"] });
    send({ type: "over" });
    send({ type: "drop", paths: ["/a.zip"] });
    vi.clearAllMocks();

    send({ type: "over" });
    send({ type: "drop", paths: [] });

    expect(onDrag).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalled();
  });

  it("keeps a file drag across a re-render with new callbacks", () => {
    const { rerender } = renderHook((props) => useDragDropEvent(props), {
      initialProps: { onDrag, onDrop, onLeave },
    });
    send({ type: "enter", paths: ["/a.zip"] });

    const newOnDrag = vi.fn();
    const newOnDrop = vi.fn();
    rerender({ onDrag: newOnDrag, onDrop: newOnDrop, onLeave });
    send({ type: "over" });
    send({ type: "drop", paths: ["/a.zip"] });

    expect(newOnDrag).toHaveBeenCalled();
    expect(newOnDrop).toHaveBeenCalledWith(["/a.zip"]);
  });
});
