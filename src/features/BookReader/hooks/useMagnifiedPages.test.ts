import { warn } from "@tauri-apps/plugin-log";
import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getImageMagnified } from "../../../bindings/binaryApi";
import type { DisplaySize } from "./useDisplaySize";
import { useMagnifiedPages } from "./useMagnifiedPages";

/** A `[width][height][data]` payload, which is what the backend answers with. */
const payload = (width: number, height: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(9);
  const view = new DataView(buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  return buffer;
};

/** A promise whose resolution the test controls. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const size: DisplaySize = { width: 400, height: 300 };

describe("useMagnifiedPages", () => {
  let nextUrl = 0;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let decodeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nextUrl = 0;
    createObjectURLMock = vi.fn(() => `blob:m-${++nextUrl}`);
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
    decodeSpy = vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue(undefined);
    vi.mocked(getImageMagnified).mockResolvedValue(payload(2000, 3000));
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("asks for nothing while the loupe is closed", async () => {
    const { result } = renderHook(() => useMagnifiedPages("book", "p1", "p2", 2, size, false));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getImageMagnified).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it("asks for nothing before the size is reported", async () => {
    const { result } = renderHook(() => useMagnifiedPages("book", "p1", "p2", 2, null, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getImageMagnified).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it("fetches each page on screen at the zoom", async () => {
    const { result } = renderHook(() => useMagnifiedPages("book", "p1", "p2", 2, size, true));

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(getImageMagnified).toHaveBeenCalledTimes(2);
    expect(getImageMagnified).toHaveBeenCalledWith("book", "p1", 2);
    expect(getImageMagnified).toHaveBeenCalledWith("book", "p2", 2);
    const p1 = result.current.get("p1");
    const p2 = result.current.get("p2");
    expect(p1).toBeInstanceOf(HTMLImageElement);
    expect(p2).toBeInstanceOf(HTMLImageElement);
    expect(p1?.src).toMatch(/^blob:m-/);
    expect(p2?.src).toMatch(/^blob:m-/);
  });

  it("keeps the pages across off and on", async () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useMagnifiedPages("book", "p1", "p2", 2, size, open),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));

    rerender({ open: false });
    rerender({ open: true });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getImageMagnified).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    expect(result.current.size).toBe(2);
  });

  it("fetches only the page a spread adds", async () => {
    const { result, rerender } = renderHook(
      ({ second }: { second: string | undefined }) =>
        useMagnifiedPages("book", "p1", second, 2, size, true),
      { initialProps: { second: undefined as string | undefined } },
    );
    await waitFor(() => expect(result.current.size).toBe(1));
    const p1 = result.current.get("p1");

    rerender({ second: "p2" });
    await waitFor(() => expect(result.current.size).toBe(2));

    expect(getImageMagnified).toHaveBeenCalledTimes(2);
    expect(getImageMagnified).toHaveBeenLastCalledWith("book", "p2", 2);
    expect(result.current.get("p1")).toBe(p1);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
  });

  it("revokes only the page a single page drops", async () => {
    const { result, rerender } = renderHook(
      ({ second }: { second: string | undefined }) =>
        useMagnifiedPages("book", "p1", second, 2, size, true),
      { initialProps: { second: "p2" as string | undefined } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    const p1 = result.current.get("p1");
    const p2Src = result.current.get("p2")?.src;

    rerender({ second: undefined });

    expect(result.current.size).toBe(1);
    expect(result.current.get("p1")).toBe(p1);
    expect(result.current.has("p2")).toBe(false);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(p2Src);
    expect(getImageMagnified).toHaveBeenCalledTimes(2);
  });

  it("fetches nothing for a new size object of the same size", async () => {
    const { result, rerender } = renderHook(
      ({ reported }: { reported: DisplaySize }) =>
        useMagnifiedPages("book", "p1", "p2", 2, reported, true),
      { initialProps: { reported: size } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));

    rerender({ reported: { ...size } });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getImageMagnified).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
  });

  it("revokes and fetches nothing when the zoom changes while closed", async () => {
    const { result, rerender } = renderHook(
      ({ zoom, open }: { zoom: number; open: boolean }) =>
        useMagnifiedPages("book", "p1", "p2", zoom, size, open),
      { initialProps: { zoom: 2, open: true } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    const urls = [...result.current.values()].map((img) => img.src);

    rerender({ zoom: 2, open: false });
    rerender({ zoom: 3, open: false });
    await act(async () => {
      await Promise.resolve();
    });

    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[0]);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[1]);
    expect(getImageMagnified).toHaveBeenCalledTimes(2);
    expect(result.current.size).toBe(0);
  });

  it("revokes and fetches anew when the zoom changes while open", async () => {
    const { result, rerender } = renderHook(
      ({ zoom }: { zoom: number }) => useMagnifiedPages("book", "p1", "p2", zoom, size, true),
      { initialProps: { zoom: 2 } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    const urls = [...result.current.values()].map((img) => img.src);

    rerender({ zoom: 3 });

    await waitFor(() => expect(getImageMagnified).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[0]);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[1]);
    expect(getImageMagnified).toHaveBeenCalledWith("book", "p1", 3);
    expect(getImageMagnified).toHaveBeenCalledWith("book", "p2", 3);
    expect(result.current.get("p1")?.src).not.toBe(urls[0]);
  });

  it("revokes and fetches nothing when the reported size changes while closed", async () => {
    const { result, rerender } = renderHook(
      ({ reported, open }: { reported: DisplaySize; open: boolean }) =>
        useMagnifiedPages("book", "p1", "p2", 2, reported, open),
      { initialProps: { reported: size, open: true } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    const urls = [...result.current.values()].map((img) => img.src);

    rerender({ reported: size, open: false });
    rerender({ reported: { width: 500, height: 300 }, open: false });
    await act(async () => {
      await Promise.resolve();
    });

    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[0]);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[1]);
    expect(getImageMagnified).toHaveBeenCalledTimes(2);
    expect(result.current.size).toBe(0);
  });

  it("revokes and fetches anew when the reported size changes while open", async () => {
    const { result, rerender } = renderHook(
      ({ reported }: { reported: DisplaySize }) =>
        useMagnifiedPages("book", "p1", "p2", 2, reported, true),
      { initialProps: { reported: size } },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    const urls = [...result.current.values()].map((img) => img.src);

    rerender({ reported: { width: 500, height: 300 } });

    await waitFor(() => expect(getImageMagnified).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[0]);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(urls[1]);
  });

  it("drops the old book's pages and answers in flight", async () => {
    const inFlightA = deferred<ArrayBuffer>();
    const pendingB = deferred<ArrayBuffer>();
    vi.mocked(getImageMagnified).mockImplementation((book, entry) => {
      if (book === "bookA" && entry === "p1") return Promise.resolve(payload(2000, 3000));
      if (book === "bookA" && entry === "p2") return inFlightA.promise;
      return pendingB.promise;
    });

    const { result, rerender } = renderHook(
      ({ book }: { book: string }) => useMagnifiedPages(book, "p1", "p2", 2, size, true),
      { initialProps: { book: "bookA" } },
    );
    await waitFor(() => expect(result.current.has("p1")).toBe(true));
    const p1Src = result.current.get("p1")?.src;

    rerender({ book: "bookB" });
    expect(revokeObjectURLMock).toHaveBeenCalledWith(p1Src);
    expect(result.current.size).toBe(0);

    await act(async () => {
      inFlightA.resolve(payload(2000, 3000));
      await Promise.resolve();
    });

    expect(result.current.size).toBe(0);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it("revokes an answer for an old zoom", async () => {
    const decodingOldZoom = deferred<void>();
    const pendingNewZoom = deferred<ArrayBuffer>();
    decodeSpy.mockReturnValueOnce(decodingOldZoom.promise);
    vi.mocked(getImageMagnified).mockImplementation((_book, _entry, zoom) =>
      zoom === 2 ? Promise.resolve(payload(2000, 3000)) : pendingNewZoom.promise,
    );

    const { result, rerender } = renderHook(
      ({ zoom }: { zoom: number }) => useMagnifiedPages("book", "p1", undefined, zoom, size, true),
      { initialProps: { zoom: 2 } },
    );
    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalledTimes(1));

    rerender({ zoom: 3 });

    await act(async () => {
      decodingOldZoom.resolve(undefined);
      await Promise.resolve();
    });

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:m-1");
    expect(result.current.size).toBe(0);
  });

  it("revokes an answer for a page turned away from", async () => {
    const inFlightP1 = deferred<ArrayBuffer>();
    const pendingP3 = deferred<ArrayBuffer>();
    vi.mocked(getImageMagnified).mockImplementation((_book, entry) =>
      entry === "p1" ? inFlightP1.promise : pendingP3.promise,
    );

    const { result, rerender } = renderHook(
      ({ first }: { first: string }) => useMagnifiedPages("book", first, undefined, 2, size, true),
      { initialProps: { first: "p1" } },
    );

    rerender({ first: "p3" });

    await act(async () => {
      inFlightP1.resolve(payload(2000, 3000));
      await Promise.resolve();
    });

    expect(result.current.has("p1")).toBe(false);
    expect(result.current.size).toBe(0);
  });

  it("does not ask twice when reopened during a fetch", async () => {
    const inFlight = deferred<ArrayBuffer>();
    vi.mocked(getImageMagnified).mockReturnValueOnce(inFlight.promise);

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useMagnifiedPages("book", "p1", undefined, 2, size, open),
      { initialProps: { open: true } },
    );

    rerender({ open: false });
    rerender({ open: true });

    expect(getImageMagnified).toHaveBeenCalledTimes(1);

    await act(async () => {
      inFlight.resolve(payload(2000, 3000));
    });

    await waitFor(() => expect(result.current.has("p1")).toBe(true));
  });

  it("asks again after a failed fetch", async () => {
    vi.mocked(getImageMagnified)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(payload(2000, 3000));

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useMagnifiedPages("book", "p1", undefined, 2, size, open),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));

    rerender({ open: false });
    rerender({ open: true });

    await waitFor(() => expect(result.current.has("p1")).toBe(true));
    expect(getImageMagnified).toHaveBeenCalledTimes(2);
  });

  it("revokes everything on unmount", async () => {
    const decodingP2 = deferred<void>();
    decodeSpy.mockResolvedValueOnce(undefined).mockReturnValueOnce(decodingP2.promise);

    const { result, unmount } = renderHook(() =>
      useMagnifiedPages("book", "p1", "p2", 2, size, true),
    );
    await waitFor(() => expect(result.current.has("p1")).toBe(true));
    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalledTimes(2));

    unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:m-1");

    await act(async () => {
      decodingP2.resolve(undefined);
      await Promise.resolve();
    });
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:m-2");
  });

  it("revokes a page that cannot be decoded", async () => {
    decodeSpy.mockRejectedValueOnce(new Error("bad image"));

    const { result } = renderHook(() => useMagnifiedPages("book", "p1", undefined, 2, size, true));

    await waitFor(() => expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:m-1"));
    expect(result.current.size).toBe(0);
  });

  it("does not decode an answer that is already stale", async () => {
    const inFlightP1 = deferred<ArrayBuffer>();
    const pendingP3 = deferred<ArrayBuffer>();
    vi.mocked(getImageMagnified).mockImplementation((_book, entry) =>
      entry === "p1" ? inFlightP1.promise : pendingP3.promise,
    );

    const { rerender } = renderHook(
      ({ first }: { first: string }) => useMagnifiedPages("book", first, undefined, 2, size, true),
      { initialProps: { first: "p1" } },
    );

    rerender({ first: "p3" });

    await act(async () => {
      inFlightP1.resolve(payload(2000, 3000));
      await Promise.resolve();
    });

    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(decodeSpy).not.toHaveBeenCalled();
  });

  it("revokes an answer that goes stale while decoding", async () => {
    const decodingP1 = deferred<void>();
    const pendingP3 = deferred<ArrayBuffer>();
    decodeSpy.mockReturnValueOnce(decodingP1.promise);
    vi.mocked(getImageMagnified).mockImplementation((_book, entry) =>
      entry === "p1" ? Promise.resolve(payload(2000, 3000)) : pendingP3.promise,
    );

    const { result, rerender } = renderHook(
      ({ first }: { first: string }) => useMagnifiedPages("book", first, undefined, 2, size, true),
      { initialProps: { first: "p1" } },
    );
    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalledTimes(1));

    rerender({ first: "p3" });

    await act(async () => {
      decodingP1.resolve(undefined);
      await Promise.resolve();
    });

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:m-1");
    expect(result.current.size).toBe(0);
  });

  it("works under StrictMode", async () => {
    const { result, unmount } = renderHook(
      () => useMagnifiedPages("book", "p1", undefined, 2, size, true),
      { wrapper: StrictMode },
    );

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get("p1")).toBeInstanceOf(HTMLImageElement);

    unmount();

    const created = createObjectURLMock.mock.results.map((r) => r.value as string);
    for (const url of created) {
      expect(revokeObjectURLMock).toHaveBeenCalledWith(url);
    }
  });
});
