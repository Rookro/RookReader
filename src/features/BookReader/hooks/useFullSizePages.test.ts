import { warn } from "@tauri-apps/plugin-log";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImageFull } from "../../../bindings/ContainerCommands";
import { useFullSizePages } from "./useFullSizePages";

/** A `[width][height][data]` payload, which is what the backend answers with. */
const payload = (width: number, height: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(9);
  const view = new DataView(buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  return buffer;
};

describe("useFullSizePages", () => {
  const entries = ["p1.jpg", "p2.jpg"];
  let nextUrl = 0;

  beforeEach(() => {
    nextUrl = 0;
    global.URL.createObjectURL = vi.fn(() => `blob:full-${++nextUrl}`);
    global.URL.revokeObjectURL = vi.fn();
    vi.mocked(getImageFull).mockResolvedValue(payload(2000, 3000));
  });

  it("asks for nothing while the loupe is closed", async () => {
    const { result } = renderHook(() => useFullSizePages("path", entries, false));

    // A full-size page is several times the weight of a displayed one, and the loupe is
    // held open for a moment at a time.
    await waitFor(() => expect(result.current.size).toBe(0));
    expect(getImageFull).not.toHaveBeenCalled();
  });

  it("asks for nothing when no page is on screen", async () => {
    renderHook(() => useFullSizePages("path", [], true));

    await waitFor(() => expect(warn).not.toHaveBeenCalled());
    expect(getImageFull).not.toHaveBeenCalled();
  });

  it("fetches every page on screen while the loupe is open", async () => {
    const { result } = renderHook(() => useFullSizePages("path", entries, true));

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(getImageFull).toHaveBeenCalledWith("path", "p1.jpg");
    expect(getImageFull).toHaveBeenCalledWith("path", "p2.jpg");
    expect(result.current.get("p1.jpg")).toMatch(/^blob:full-/);
  });

  it("revokes the copies when the loupe closes", async () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useFullSizePages("path", entries, open),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    const held = [...result.current.values()];

    rerender({ open: false });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(held[0]);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(held[1]);
    expect(result.current.size).toBe(0);
  });

  it("replaces the copies when the page turns", async () => {
    const { result, rerender } = renderHook(
      ({ shown }: { shown: string[] }) => useFullSizePages("path", shown, true),
      { initialProps: { shown: ["p1.jpg"] } },
    );
    await waitFor(() => expect(result.current.size).toBe(1));
    const first = result.current.get("p1.jpg");

    rerender({ shown: ["p3.jpg"] });

    await waitFor(() => expect(result.current.get("p3.jpg")).toBeDefined());
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(first);
    expect(result.current.has("p1.jpg")).toBe(false);
  });

  it("leaves a page out when it cannot be read at full size", async () => {
    vi.mocked(getImageFull)
      .mockRejectedValueOnce(new Error("decode failed"))
      .mockResolvedValueOnce(payload(2000, 3000));

    const { result } = renderHook(() => useFullSizePages("path", entries, true));

    // The caller falls back to the displayed page: softer under the lens, never blank.
    await waitFor(() => expect(warn).toHaveBeenCalled());
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.has("p1.jpg")).toBe(false);
  });

  it("revokes a copy that arrives after the loupe has closed", async () => {
    let deliver: (buffer: ArrayBuffer) => void = () => {};
    vi.mocked(getImageFull).mockReturnValueOnce(
      new Promise((resolve) => {
        deliver = resolve;
      }),
    );

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useFullSizePages("path", ["p1.jpg"], open),
      { initialProps: { open: true } },
    );
    rerender({ open: false });
    deliver(payload(2000, 3000));

    // The request is already out when the reader lets the lens go; what comes back has
    // to be let go of too, or a held blob outlives every loupe that was ever opened.
    await waitFor(() => expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:full-1"));
  });
});
