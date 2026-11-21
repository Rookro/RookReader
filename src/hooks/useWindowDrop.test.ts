import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDragDropEvent } from "./useDragDropEvent";
import { useWindowDrop } from "./useWindowDrop";

vi.mock("./useDragDropEvent", () => ({ useDragDropEvent: vi.fn() }));

const handlers = () => {
  const last = vi.mocked(useDragDropEvent).mock.lastCall?.[0];
  if (!last) {
    throw new Error("useDragDropEvent was not called");
  }
  return last;
};

describe("useWindowDrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a drag over the window until it leaves", () => {
    const { result } = renderHook(() => useWindowDrop(vi.fn()));
    expect(result.current).toBe(false);

    act(() => handlers().onDrag?.());
    expect(result.current).toBe(true);

    act(() => handlers().onLeave?.());
    expect(result.current).toBe(false);
  });

  it("hands over the dropped paths and ends the drag", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useWindowDrop(onDrop));

    act(() => handlers().onDrag?.());
    act(() => handlers().onDrop?.(["/a.zip"]));

    expect(onDrop).toHaveBeenCalledWith(["/a.zip"]);
    expect(result.current).toBe(false);
  });
});
