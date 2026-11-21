import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useContextMenuRegistry } from "./useContextMenuRegistry";

describe("useContextMenuRegistry", () => {
  it("opens the menu registered for a key with the row", () => {
    const { result } = renderHook(() => useContextMenuRegistry<number>());
    const row = document.createElement("div");
    const openAt = vi.fn();

    result.current.register(1, openAt);
    result.current.open(1, row);
    expect(openAt).toHaveBeenCalledExactlyOnceWith(row);

    result.current.open(2, row);
    expect(openAt).toHaveBeenCalledTimes(1);
  });

  it("keeps a newer registration when an older one unregisters", () => {
    const { result } = renderHook(() => useContextMenuRegistry<number>());
    const row = document.createElement("div");
    const openerA = vi.fn();
    const openerB = vi.fn();

    const unregisterA = result.current.register(1, openerA);
    result.current.register(1, openerB);
    unregisterA();
    result.current.open(1, row);

    expect(openerA).not.toHaveBeenCalled();
    expect(openerB).toHaveBeenCalledExactlyOnceWith(row);
  });

  it("keeps register and open stable across renders", () => {
    const { result, rerender } = renderHook(() => useContextMenuRegistry<number>());
    const { register, open } = result.current;

    rerender();

    expect(result.current.register).toBe(register);
    expect(result.current.open).toBe(open);
  });
});
