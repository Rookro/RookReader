import { warn } from "@tauri-apps/plugin-log";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../bindings/api";
import { createMockBookWithState } from "../../../test/factories";
import { CommandError, ErrorCode } from "../../../types/Error";
import type { Image } from "../../../types/Image";
import * as perfLog from "../../../utils/perf";
import { setImageIndex, setSpreadDisplayed } from "../slice";
import * as ImageUtils from "../utils/ImageUtils";
import { pagesAhead } from "../utils/pageLoading";
import type { DisplaySize } from "./useDisplaySize";
import { useViewerController, type ViewerControllerOptions } from "./useViewerController";

/**
 * A viewport the reader has already measured.
 *
 * Every test needs one: pages are rendered to fit it, so nothing loads until it is known.
 */
const VIEWPORT: DisplaySize = { width: 1024, height: 1536 };

/** A viewport the reader has been resized to. */
const WIDER: DisplaySize = { width: 2048, height: 1536 };

vi.mock("../utils/ImageUtils", () => ({
  SINGLE_UNIT: { isSpread: false, nextIndexIncrement: 1 },
  // Default to a chain of single pages. Display is gated on the chain now, so a test that
  // does not care how the book pairs still needs one to exist.
  buildUnitChain: vi.fn((landscape: boolean[]) => ({
    starts: landscape.map((_, i) => i),
    units: new Map(
      landscape.map((_, i) => [i, { isSpread: false, nextIndexIncrement: 1 }] as const),
    ),
  })),
  // Default to null so the configured cover setting is used unless a test proves one.
  detectCoverPresence: vi.fn(() => null),
  fetchImageBlob: vi.fn(),
  fetchImagePreviewBlob: vi.fn(),
  createImageCacheItem: vi.fn(),
  buildSinglePageLayout: vi.fn((firstImage, firstEntry) => ({
    firstImage,
    firstEntry,
    isSpread: false,
    nextIndexIncrement: 1,
  })),
  // Mirror the real implementation so displayedLayout reflects what is actually cached.
  buildUnitLayout: vi.fn(
    (
      unit: ImageUtils.UnitDecision,
      currentIndex: number,
      entries: string[],
      cache: Map<string, ImageUtils.ImageCacheItem>,
      failures: ReadonlyMap<string, number>,
    ) => {
      const firstEntry = entries[currentIndex];
      const firstImage = cache.get(firstEntry);
      const firstError = firstImage ? undefined : failures.get(firstEntry);
      if (!firstImage && firstError === undefined) {
        return null;
      }
      if (!unit.isSpread) {
        return {
          firstImage,
          firstEntry,
          firstError,
          isSpread: false,
          nextIndexIncrement: unit.nextIndexIncrement,
        };
      }
      const secondEntry = entries[currentIndex + 1];
      const secondImage = cache.get(secondEntry);
      const secondError = secondImage ? undefined : failures.get(secondEntry);
      if (!secondImage && secondError === undefined) {
        return null;
      }
      return {
        firstImage,
        firstEntry,
        secondImage,
        secondEntry,
        firstError,
        secondError,
        isSpread: true,
        nextIndexIncrement: unit.nextIndexIncrement,
      };
    },
  ),
  // Mirror the real per-item revoke so cache-eviction tests observe revokeObjectURL.
  revokeCacheItemUrls: vi.fn((item: ImageUtils.ImageCacheItem) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    if (item.fullUrl) {
      URL.revokeObjectURL(item.fullUrl);
    }
  }),
}));

vi.mock("../../../utils/perf", () => ({
  perf: vi.fn(),
  perfStart: vi.fn(() => 0),
  perfSince: vi.fn((started: number | null) => (started === null ? null : 1234)),
}));

vi.mock("../reducers/ReadReducer", () => ({
  setImageIndex: vi.fn((idx: number) => ({ type: "read/setImageIndex", payload: idx })),
}));

// Nothing is loaded ahead unless a test asks for it, so the other tests' fetch counts hold.
vi.mock("../utils/pageLoading", async (importActual) => ({
  ...(await importActual<typeof import("../utils/pageLoading")>()),
  pagesAhead: vi.fn(() => []),
}));
const { pagesAhead: realPagesAhead } =
  await vi.importActual<typeof import("../utils/pageLoading")>("../utils/pageLoading");

describe("useViewerController", () => {
  const mockEntries = ["p1.jpg", "p2.jpg", "p3.jpg"];
  const mockDispatch = vi.fn();
  const mockSettings: ImageUtils.ViewerSettings = {
    isTwoPagedView: false,
    isFirstPageSingleView: false,
    direction: "ltr",
    enablePreview: false,
    preloadPageCount: 10,
  };

  const mockedFetchImageBlob = vi.mocked(ImageUtils.fetchImageBlob);
  const mockedCreateImageCacheItem = vi.mocked(ImageUtils.createImageCacheItem);
  const mockedBuildUnitChain = vi.mocked(ImageUtils.buildUnitChain);
  const mockedDetectCoverPresence = vi.mocked(ImageUtils.detectCoverPresence);

  /** Gives each load its own cache item and URL, `blob:0`, `blob:1`, … in load order. */
  const urlPerLoad = () => {
    let next = 0;
    mockedCreateImageCacheItem.mockImplementation(() => {
      const url = `blob:${next++}`;
      return { fullUrl: url, url, width: 100, height: 200 } as ImageUtils.ImageCacheItem;
    });
  };

  /** A fetch that resolves when the test says so. */
  const heldFetch = () => {
    let deliver: () => void = () => {};
    const promise = new Promise<Image>((resolve) => {
      deliver = () => resolve({} as Image);
    });
    return { promise, deliver };
  };

  /** Makes the dimension scan report `count` portrait pages. */
  const mockScan = (count: number) => {
    vi.mocked(api.getImageDimensions).mockResolvedValue(
      Array.from({ length: count }, () => ({ width: 100, height: 200 })),
    );
  };

  /** A chain that pairs every two pages, for tests about spread display. */
  const spreadPairs = (landscape: boolean[]) => {
    const units = new Map<number, ImageUtils.UnitDecision>();
    const starts: number[] = [];
    for (let i = 0; i < landscape.length; i += 2) {
      const isSpread = i + 1 < landscape.length;
      units.set(i, { isSpread, nextIndexIncrement: isSpread ? 2 : 1 });
      starts.push(i);
    }
    return { starts, units };
  };

  /** A chain of single pages covering `landscape`, the shape most tests want. */
  const singlePages = (landscape: boolean[]) => ({
    starts: landscape.map((_, i) => i),
    units: new Map(
      landscape.map((_, i) => [i, { isSpread: false, nextIndexIncrement: 1 }] as const),
    ),
  });

  /** Asserts no page move happened, ignoring the spread flag the hook always publishes. */
  const expectNoPageMove = () => {
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: setImageIndex.type }),
    );
  };

  const renderMoves = (index: number, extra: Partial<ViewerControllerOptions> = {}) =>
    renderHook(() =>
      useViewerController({
        containerPath: "path",
        displaySize: VIEWPORT,
        entries: mockEntries,
        index,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
        hasPreviews: true,
        ...extra,
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.revokeObjectURL = vi.fn();
    // The viewer holds its layout until the book has been measured, so every test needs a
    // measurement to arrive; `mockReturnValue` survives clearAllMocks, so both defaults
    // are restored here rather than set once.
    mockScan(mockEntries.length);
    mockedBuildUnitChain.mockImplementation(singlePages);
    mockedDetectCoverPresence.mockReturnValue(null);
    vi.mocked(pagesAhead).mockReturnValue([]);
  });

  // Verify that loading flag is true and displayedLayout is null on initialization
  it("should initialize with loading true and displayedLayout null", () => {
    // Both fetches must not resolve so that loading stays true
    mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
    vi.mocked(ImageUtils.fetchImagePreviewBlob).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() =>
      useViewerController({
        containerPath: "path",
        displaySize: VIEWPORT,
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: { ...mockSettings, enablePreview: true },
        dispatch: mockDispatch,
        hasPreviews: true,
      }),
    );

    expect(result.current.isImageLoading).toBe(true);
    expect(result.current.displayedLayout).toBeNull();
  });

  // Verify that old object URLs are revoked when containerPath changes
  it("should revoke object URLs on containerPath change", async () => {
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({
      fullUrl: "blob:full",
      previewUrl: "blob:preview",
    } as ImageUtils.ImageCacheItem);

    const { rerender } = renderHook(
      ({ path }: { path: string }) =>
        useViewerController({
          containerPath: path,
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      { initialProps: { path: "path1" } },
    );

    await waitFor(() => expect(ImageUtils.createImageCacheItem).toHaveBeenCalled());

    rerender({ path: "path2" });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:full");
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  // Verify the next book's first page is fetched rather than taken from the previous
  // book's cache. A measured book keeps a pairing across the switch, so a stale entry
  // would reach the layout.
  it("never shows the previous book's page after a switch", async () => {
    const measured = createMockBookWithState({ landscapeBits: "000" });
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({
      fullUrl: "blob:old",
      url: "blob:old",
      width: 100,
      height: 200,
    } as ImageUtils.ImageCacheItem);

    const { result, rerender } = renderHook(
      ({ path }: { path: string }) =>
        useViewerController({
          containerPath: path,
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
          book: measured,
        }),
      { initialProps: { path: "path1" } },
    );
    await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());

    mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
    rerender({ path: "path2" });
    await act(async () => {
      await new Promise(process.nextTick);
    });

    expect(mockedFetchImageBlob).toHaveBeenCalledWith("path2", "p1.jpg", expect.any(Number));
    expect(result.current.displayedLayout).toBeNull();
  });

  // Verify a page that lands just as the reader moves on is not shown over the page they
  // moved to
  it("never shows a page the reader has already left", async () => {
    const measured = createMockBookWithState({ landscapeBits: "000" });
    const images = new Map(mockEntries.map((entry) => [entry, { entry } as unknown as Image]));
    mockedCreateImageCacheItem.mockImplementation(
      (img) =>
        ({
          fullUrl: `blob:${[...images].find(([, image]) => image === img)?.[0]}`,
          width: 100,
          height: 200,
        }) as ImageUtils.ImageCacheItem,
    );
    let releaseFirst: () => void = () => {};
    mockedFetchImageBlob.mockImplementation((_path, entry) =>
      entry === "p1.jpg"
        ? new Promise<Image>((resolve) => {
            releaseFirst = () => resolve(images.get(entry) as Image);
          })
        : Promise.resolve(images.get(entry)),
    );

    const { result, rerender } = renderHook(
      ({ index }: { index: number }) =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: false,
          book: measured,
        }),
      { initialProps: { index: 1 } },
    );
    await waitFor(() =>
      expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:p2.jpg"),
    );
    rerender({ index: 0 });
    await act(async () => {
      await new Promise(process.nextTick);
    });

    // The first page lands, and in the same tick the reader moves back to the second.
    releaseFirst();
    queueMicrotask(() => {
      rerender({ index: 1 });
    });
    // Let the microtasks run outside act, as they do in the app.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(async () => {
      await new Promise(process.nextTick);
    });

    expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:p2.jpg");
  });

  // Verify that remaining object URLs are revoked when the hook unmounts
  it("should revoke object URLs on unmount", async () => {
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({
      fullUrl: "blob:full",
      previewUrl: "blob:preview",
    } as ImageUtils.ImageCacheItem);

    const { unmount } = renderHook(() =>
      useViewerController({
        containerPath: "path",
        displaySize: VIEWPORT,
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
        hasPreviews: true,
      }),
    );

    await waitFor(() => expect(ImageUtils.createImageCacheItem).toHaveBeenCalled());

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:full");
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  // Verify that pages outside a window around the current index are evicted (their
  // blob URLs revoked) while pages inside the window survive, so long reading
  // sessions don't accumulate every visited page's blob URLs.
  it("should evict cached pages outside the window and keep those inside", async () => {
    const longEntries = Array.from({ length: 100 }, (_, i) => `p${i}.jpg`);
    mockScan(longEntries.length);
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    let urlCounter = 0;
    mockedCreateImageCacheItem.mockImplementation(
      () => ({ fullUrl: `blob:${urlCounter++}` }) as ImageUtils.ImageCacheItem,
    );

    const { rerender } = renderHook(
      ({ index }: { index: number }) =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: longEntries,
          index,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      { initialProps: { index: 0 } },
    );

    // entries[0] is cached as "blob:0".
    await waitFor(() => expect(ImageUtils.createImageCacheItem).toHaveBeenCalled());

    // Navigate within the window (radius = max(preloadPageCount, 5) = 10): entries[0] survives.
    rerender({ index: 5 });
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:0");

    // Once page 50 has replaced it on screen, entries[0] is revoked.
    rerender({ index: 50 });
    await waitFor(() => expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0"));
  });

  it("keeps the page on screen through a far jump until the page jumped to is shown", async () => {
    const longEntries = Array.from({ length: 100 }, (_, i) => `p${i}.jpg`);
    mockScan(longEntries.length);
    const replacement = heldFetch();
    mockedFetchImageBlob
      .mockResolvedValue({} as Image)
      .mockResolvedValueOnce({} as Image)
      .mockResolvedValueOnce({} as Image)
      .mockReturnValueOnce(replacement.promise);
    urlPerLoad();

    const { result, rerender } = renderHook(
      ({ index }: { index: number }) =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: longEntries,
          index,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      { initialProps: { index: 0 } },
    );

    await waitFor(() => expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:0"));
    rerender({ index: 1 });
    await waitFor(() => expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:1"));

    rerender({ index: 50 });
    await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(3));
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:1");

    act(() => {
      replacement.deliver();
    });
    await waitFor(() => expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:2"));
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  // Verify that displayedLayout is set on successful image loading
  it("should load image and set displayedLayout when successful", async () => {
    const mockLayout: ImageUtils.ViewLayout = {
      nextIndexIncrement: 1,
      isSpread: false,
      firstEntry: "p1.jpg",
      firstImage: {
        url: "url1",
        width: 100,
        height: 100,
        fullUrl: "url1",
      } as ImageUtils.ImageCacheItem,
    };
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({
      fullUrl: "url1",
      previewUrl: undefined,
      width: 100,
      height: 100,
      url: "url1",
    } as ImageUtils.ImageCacheItem);

    const { result } = renderHook(() =>
      useViewerController({
        containerPath: "path",
        displaySize: VIEWPORT,
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
        hasPreviews: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.isImageLoading).toBe(false);
      expect(result.current.displayedLayout).not.toBeNull();
    });

    expect(result.current.displayedLayout).toEqual(mockLayout);
    expect(result.current.reportedSize).toEqual(VIEWPORT);
  });

  // Verify that a spread on screen is published to the store for the page list
  it("should dispatch setSpreadDisplayed(true) while a spread is displayed", async () => {
    mockedBuildUnitChain.mockImplementation(spreadPairs);
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({ fullUrl: "url" } as ImageUtils.ImageCacheItem);

    renderHook(() =>
      useViewerController({
        containerPath: "path",
        displaySize: VIEWPORT,
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: { ...mockSettings, isTwoPagedView: true },
        dispatch: mockDispatch,
        hasPreviews: true,
      }),
    );

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setSpreadDisplayed(true)));
  });

  // Verify that a single-page layout is published as such
  it("should dispatch setSpreadDisplayed(false) while a single page is displayed", async () => {
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({ fullUrl: "url" } as ImageUtils.ImageCacheItem);

    renderHook(() =>
      useViewerController({
        containerPath: "path",
        displaySize: VIEWPORT,
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
        hasPreviews: true,
      }),
    );

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setSpreadDisplayed(false)));
  });

  // Verify that fetching is not performed for images that are already cached
  it("should handle already cached images", async () => {
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({
      fullUrl: "url1",
      url: "url1",
    } as ImageUtils.ImageCacheItem);

    const { result, rerender } = renderHook(
      ({ index }: { index: number }) =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      { initialProps: { index: 0 } },
    );

    await waitFor(() => expect(result.current.isImageLoading).toBe(false));
    expect(mockedFetchImageBlob).toHaveBeenCalledTimes(1);

    // Change index to 1 to cache it too
    rerender({ index: 1 });
    await waitFor(() => expect(result.current.isImageLoading).toBe(false));
    expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2);

    // Change index back to 0 which is already cached
    rerender({ index: 0 });
    await waitFor(() => expect(result.current.isImageLoading).toBe(false));
    // Should NOT call fetch again
    expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2);
  });

  describe("moveForward", () => {
    // Verify that index update action is dispatched correctly when moving to the next page
    it("should dispatch setImageIndex with next index", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      expect(result.current.moveForward()).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that action is not dispatched if the next page is out of bounds
    it("should not dispatch if next index is out of bounds", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expectNoPageMove();
    });

    // Verify that moving forward does nothing if entries are empty
    it("should do nothing if entries are empty", () => {
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: [],
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );
      expect(result.current.moveForward()).toBe(false);
      expectNoPageMove();
    });

    // Verify that the forward boundary callback fires at the last page (instead of dispatching)
    it("should call onForwardBoundary at the last page", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      const onForwardBoundary = vi.fn();

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
          onForwardBoundary,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveForward();
      expectNoPageMove();
      expect(onForwardBoundary).toHaveBeenCalledTimes(1);
    });

    it("moves several pages in one call", () => {
      const { result } = renderMoves(0);
      expect(result.current.moveForward({ steps: 2 })).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
      expect(mockDispatch).not.toHaveBeenCalledWith(setImageIndex(1));
    });

    it("stops on the last page without crossing books when steps run out", () => {
      const onForwardBoundary = vi.fn();
      const { result } = renderMoves(0, { onForwardBoundary });
      expect(result.current.moveForward({ steps: 5 })).toBe(false);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
      expect(onForwardBoundary).not.toHaveBeenCalled();
    });

    it("stays on the last page when asked not to cross books", () => {
      const onForwardBoundary = vi.fn();
      const { result } = renderMoves(2, { onForwardBoundary });
      expect(result.current.moveForward({ crossBook: false })).toBe(false);
      expectNoPageMove();
      expect(onForwardBoundary).not.toHaveBeenCalled();
      expect(result.current.moveForward()).toBe(false);
      expect(onForwardBoundary).toHaveBeenCalledTimes(1);
    });
  });

  describe("moveBack", () => {
    // Verify that index update action is dispatched correctly when moving to the previous page
    it("should dispatch setImageIndex with previous index", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      expect(result.current.moveBack()).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
    });

    // Verify that action is not dispatched when moving back from the first page (index 0)
    it("should not dispatch if current index is 0", async () => {
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      result.current.moveBack();
      expectNoPageMove();
    });

    // Verify that moving back does nothing if entries are empty
    it("should handle moveBack when entries are empty", () => {
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: [],
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );
      expect(result.current.moveBack()).toBe(false);
      expectNoPageMove();
    });

    // Verify that the backward boundary callback fires at the first page (instead of dispatching)
    it("should call onBackwardBoundary at the first page", () => {
      const onBackwardBoundary = vi.fn();
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
          onForwardBoundary: undefined,
          onBackwardBoundary,
        }),
      );

      result.current.moveBack();
      expectNoPageMove();
      expect(onBackwardBoundary).toHaveBeenCalledTimes(1);
    });

    it("moves several pages back in one call", () => {
      const { result } = renderMoves(2);
      expect(result.current.moveBack({ steps: 2 })).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
      expect(mockDispatch).not.toHaveBeenCalledWith(setImageIndex(1));
    });

    it("stops on the first page without crossing books when steps run out", () => {
      const onBackwardBoundary = vi.fn();
      const { result } = renderMoves(2, { onBackwardBoundary });
      expect(result.current.moveBack({ steps: 5 })).toBe(false);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
      expect(onBackwardBoundary).not.toHaveBeenCalled();
    });

    it("stays on the first page when asked not to cross books", () => {
      const onBackwardBoundary = vi.fn();
      const { result } = renderMoves(0, { onBackwardBoundary });
      expect(result.current.moveBack({ crossBook: false })).toBe(false);
      expectNoPageMove();
      expect(onBackwardBoundary).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    // Verify that loading flag becomes false on image acquisition failure
    it("should set isImageLoading to false when fetch fails", async () => {
      mockedFetchImageBlob.mockRejectedValue(new CommandError(ErrorCode.image, "decode failed"));

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      expect(result.current.displayedLayout?.firstImage).toBeUndefined();
    });

    // Verify that a page which cannot be loaded reports its reason in the page's own place
    it("reports why the current page could not be shown", async () => {
      mockedFetchImageBlob.mockRejectedValue(new CommandError(ErrorCode.image, "decode failed"));

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.displayedLayout?.firstError).toBe(ErrorCode.image);
      });
      expect(result.current.displayedLayout?.firstImage).toBeUndefined();
    });

    // Verify the page before the failed one is replaced, not left on screen as though the
    // page turn had not registered
    it("takes the previous page off screen when the next one fails", async () => {
      mockedFetchImageBlob.mockImplementation((_path, entry) =>
        entry === "p1.jpg"
          ? Promise.resolve({} as Image)
          : Promise.reject(new CommandError(ErrorCode.image, "decode failed")),
      );
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url1",
        url: "url1",
      } as ImageUtils.ImageCacheItem);

      const { result, rerender } = renderHook(
        ({ index }: { index: number }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: mockSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());

      rerender({ index: 1 });

      await waitFor(() => {
        expect(result.current.displayedLayout?.firstError).toBe(ErrorCode.image);
      });
      expect(result.current.displayedLayout?.firstImage).toBeUndefined();
    });

    // A page that came out of its preview is on screen, so there is nothing to report
    it("stays silent when the page resolved from its preview", async () => {
      mockedFetchImageBlob.mockRejectedValue(new CommandError(ErrorCode.image, "decode failed"));
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        previewUrl: "preview1",
        url: "preview1",
      } as ImageUtils.ImageCacheItem);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: { ...mockSettings, enablePreview: true },
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.displayedLayout).not.toBeNull();
      });
      expect(result.current.displayedLayout?.firstError).toBeUndefined();
    });
  });

  describe("two-paged view", () => {
    const twoPagedSettings: ImageUtils.ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    // Verify that index increments by 2 in spread (two-paged) view
    it("should increment index by 2 when the current unit is a spread", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedBuildUnitChain.mockImplementation(spreadPairs);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
    });

    // Verify that a book still being measured advances by 1, never 2, so a page is never
    // permanently skipped while the pairing is unknown.
    it("should advance by 1 while the book is still being measured", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // The book has not been measured, so the chain never lands and every unit is a
      // single page.
      vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      // The viewer is still holding its layout, but navigation is not gated on that.
      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalled());

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    /** Builds a chain from a per-start map of unit increments. */
    const mockUnitsByIndex = (increments: Record<number, 1 | 2>) => {
      const units = new Map(
        Object.entries(increments).map(([start, increment]) => [
          Number(start),
          { isSpread: increment === 2, nextIndexIncrement: increment },
        ]),
      );
      mockedBuildUnitChain.mockReturnValue({
        starts: [...units.keys()].sort((a, b) => a - b),
        units,
      });
    };

    // Verify that moveBack lands on the single unit before a page whose pair is landscape
    it("should go back 1 page when the page before is a single unit", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // Chain around index 2: {0} {1} {2} - page 1 is single, so index 2 follows it directly.
      mockUnitsByIndex({ 0: 1, 1: 1 });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveBack();
      // The unit at index 0 advances by 1, so it cannot be the unit preceding index 2.
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that a mid-spread current index re-aligns to the spread that contains it
    it("should re-align to the containing spread when the current index is mid-spread", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // Chain: {0} {1,2} - index 2 is the second page of the spread starting at 1.
      mockUnitsByIndex({ 0: 1, 1: 2 });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      result.current.moveBack();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify the viewer degrades to a single page when the spread's second page fails to load
    it("should fall back to a single-page layout when the spread's second page fails to load", async () => {
      // First page loads; the second page fetch fails (resolves undefined).
      mockedFetchImageBlob.mockImplementation((_path, entry) =>
        Promise.resolve(entry === "p1.jpg" ? ({} as Image) : undefined),
      );
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url1",
        url: "url1",
        width: 100,
        height: 200,
      } as ImageUtils.ImageCacheItem);
      // A spread is the current unit, but its second page never reaches the cache.
      mockedBuildUnitChain.mockImplementation(spreadPairs);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      // Degraded to a single-page layout for the first image instead of staying null.
      expect(result.current.displayedLayout).not.toBeNull();
      expect(result.current.displayedLayout?.isSpread).toBe(false);
      expect(result.current.displayedLayout?.nextIndexIncrement).toBe(1);
      expect(result.current.displayedLayout?.firstImage).toEqual({
        fullUrl: "url1",
        url: "url1",
        width: 100,
        height: 200,
      });
    });

    // The failure belongs to one page of the pair, so the other keeps its place beside it
    it("keeps the spread together when only its second page fails", async () => {
      mockedFetchImageBlob.mockImplementation((_path, entry) =>
        entry === "p1.jpg"
          ? Promise.resolve({} as Image)
          : Promise.reject(new CommandError(ErrorCode.entryNotFound, "missing")),
      );
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url1",
        url: "url1",
      } as ImageUtils.ImageCacheItem);
      mockedBuildUnitChain.mockImplementation(spreadPairs);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.displayedLayout?.secondError).toBe(ErrorCode.entryNotFound);
      });
      expect(result.current.displayedLayout?.isSpread).toBe(true);
      expect(result.current.displayedLayout?.firstImage).toEqual({
        fullUrl: "url1",
        url: "url1",
      });
    });

    // Verify both halves say why, so two failures read as two failed pages
    it("gives each page of a spread its own reason", async () => {
      mockedFetchImageBlob.mockImplementation((_path, entry) =>
        Promise.reject(
          new CommandError(entry === "p1.jpg" ? ErrorCode.image : ErrorCode.entryNotFound, "no"),
        ),
      );
      mockedBuildUnitChain.mockImplementation(spreadPairs);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.displayedLayout?.firstError).toBe(ErrorCode.image);
      });
      expect(result.current.displayedLayout?.secondError).toBe(ErrorCode.entryNotFound);
      expect(result.current.displayedLayout?.isSpread).toBe(true);
    });

    it("keeps both pages of a spread on screen through a viewport change", async () => {
      const replacement1 = heldFetch();
      const replacement2 = heldFetch();
      mockedFetchImageBlob
        .mockResolvedValue({} as Image)
        .mockResolvedValueOnce({} as Image)
        .mockResolvedValueOnce({} as Image)
        .mockReturnValueOnce(replacement1.promise)
        .mockReturnValueOnce(replacement2.promise);
      mockedBuildUnitChain.mockImplementation(spreadPairs);
      urlPerLoad();

      const { result, rerender } = renderHook(
        ({ size }: { size: DisplaySize }) =>
          useViewerController({
            containerPath: "path",
            displaySize: size,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { size: VIEWPORT } },
      );

      await waitFor(() => {
        expect(result.current.displayedLayout?.isSpread).toBe(true);
        expect(
          [
            result.current.displayedLayout?.firstImage?.fullUrl,
            result.current.displayedLayout?.secondImage?.fullUrl,
          ].sort(),
        ).toEqual(["blob:0", "blob:1"]);
      });

      rerender({ size: WIDER });
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(4));
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:0");
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:1");

      act(() => {
        replacement1.deliver();
        replacement2.deliver();
      });
      await waitFor(() => {
        expect(result.current.displayedLayout?.isSpread).toBe(true);
        expect(
          [
            result.current.displayedLayout?.firstImage?.fullUrl,
            result.current.displayedLayout?.secondImage?.fullUrl,
          ].sort(),
        ).toEqual(["blob:2", "blob:3"]);
      });
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    });
  });

  describe("scanned unit chain", () => {
    const twoPagedSettings: ImageUtils.ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    /** Makes buildUnitChain return a chain built from the given unit increments. */
    const mockChain = (increments: Record<number, 1 | 2>) => {
      const units = new Map(
        Object.entries(increments).map(([start, increment]) => [
          Number(start),
          { isSpread: increment === 2, nextIndexIncrement: increment },
        ]),
      );
      mockedBuildUnitChain.mockReturnValue({
        starts: [...units.keys()].sort((a, b) => a - b),
        units,
      });
    };

    it("steps by units and stops on the last one in spread view", async () => {
      // {0} {1,2}
      mockChain({ 0: 1, 1: 2 });
      const onForwardBoundary = vi.fn();
      const { result } = renderMoves(0, { settings: twoPagedSettings, onForwardBoundary });
      // A layout appears only once the pairing is known.
      await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());
      expect(result.current.moveForward({ steps: 3 })).toBe(false);
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
      expect(mockDispatch).not.toHaveBeenCalledWith(setImageIndex(2));
      expect(onForwardBoundary).not.toHaveBeenCalled();
    });

    /** The landscape flags the scan below reports, in entry order. */
    const MEASURED = [false, true, false];

    beforeEach(() => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url",
        url: "url",
        width: 100,
        height: 200,
      } as ImageUtils.ImageCacheItem);
      // One landscape page, so an assertion can name the measured chain's call: the
      // assumed chain sees only the pages the viewer has loaded, never this.
      vi.mocked(api.getImageDimensions).mockResolvedValue([
        { width: 100, height: 200 },
        { width: 200, height: 100 },
        { width: 100, height: 200 },
      ]);
    });

    // Verify the chain's boundary wins over the walk and the local heuristic
    it("moves back to the chain's previous unit start", async () => {
      // {0} {1,2}
      mockChain({ 0: 1, 1: 2 });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());

      result.current.moveBack();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
    });

    // Verify the chain's unit, not the local rule, drives the forward increment
    it("moves forward by the chain's increment", async () => {
      // {0} {1,2} - the chain says index 0 is a single page.
      mockChain({ 0: 1, 1: 2 });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify a proven cover presence outranks the configured setting
    it("builds the chain from the detected cover presence", async () => {
      mockChain({ 0: 1, 1: 2 });
      mockedDetectCoverPresence.mockReturnValue(!twoPagedSettings.isFirstPageSingleView);

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          { isTwoPagedView: true },
          !twoPagedSettings.isFirstPageSingleView,
        ),
      );
    });

    // Verify the reader's toggle still wins over a proven cover presence
    it("inverts the detected cover presence when the book is shifted", async () => {
      mockChain({ 0: 1, 1: 2 });
      mockedDetectCoverPresence.mockReturnValue(true);

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 1,
          isSpreadShifted: true,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          { isTwoPagedView: true },
          false,
        ),
      );
    });

    // Verify an unshifted book takes cover presence straight from the setting
    it("builds the chain with the configured cover presence", async () => {
      mockChain({ 0: 1, 1: 2 });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          { isTwoPagedView: true },
          twoPagedSettings.isFirstPageSingleView,
        ),
      );
    });

    // Verify a shifted book inverts cover presence, which is what moves every pair by one
    it("builds the chain with cover presence inverted when the book is shifted", async () => {
      mockChain({ 0: 1, 1: 2 });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 1,
          isSpreadShifted: true,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          { isTwoPagedView: true },
          !twoPagedSettings.isFirstPageSingleView,
        ),
      );
    });

    // Verify a page reached mid-unit is pulled back to the unit that contains it
    it("snaps an index that landed inside a unit back to its unit start", async () => {
      // {0} {1,2} - index 2 is the second page of the spread starting at 1.
      mockChain({ 0: 1, 1: 2 });

      const { result, rerender } = renderHook(
        ({ index }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      mockDispatch.mockClear();

      rerender({ index: 2 });
      await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1)));
      expect(result.current).toBeDefined();
    });

    // Verify an index that already starts a unit is left alone
    it("does not snap an index that already starts a unit", async () => {
      mockChain({ 0: 1, 1: 2 });

      const { rerender } = renderHook(
        ({ index }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      mockDispatch.mockClear();

      rerender({ index: 1 });
      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      expectNoPageMove();
    });

    // Verify navigation this hook dispatched never changes the pairing
    it("never shifts the pairing on its own navigation", async () => {
      mockChain({ 0: 1, 1: 1, 2: 1 });

      const { result, rerender } = renderHook(
        ({ index }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
      rerender({ index: 1 });
      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      // Where the reader navigated must leave no trace on how the book pairs.
      expect(mockedBuildUnitChain.mock.calls.map((call) => call[2])).not.toContain(true);
    });

    // Verify a failed scan leaves the viewer on the fallback instead of breaking it
    it("keeps working when the scan fails", async () => {
      vi.useFakeTimers();
      vi.mocked(api.getImageDimensions).mockRejectedValue(new Error("scan failed"));

      try {
        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );

        // The chain never arrives, so the wait cap is what lets the reader read.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(result.current.isImageLoading).toBe(false);
        expect(result.current.displayedLayout).not.toBeNull();
        // A failed scan is a book that offered no evidence, so the setting decides.
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          { isTwoPagedView: true },
          twoPagedSettings.isFirstPageSingleView,
        );
        // Navigation still steps one page at a time: only the book's own chain may say
        // a step is two.
        result.current.moveForward();
        expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("the book's own pairing", () => {
    const twoPaged: ImageUtils.ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };
    const singlePaged: ImageUtils.ViewerSettings = { ...twoPaged, isTwoPagedView: false };

    /** Pairs like the real chain builder: spreads only in spread view. */
    const pairBySetting = () =>
      mockedBuildUnitChain.mockImplementation((landscape, settings) =>
        settings.isTwoPagedView ? spreadPairs(landscape) : singlePages(landscape),
      );

    beforeEach(() => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url",
        url: "url",
        width: 100,
        height: 200,
      } as ImageUtils.ImageCacheItem);
    });

    // Verify where the reader entered the book leaves no trace on how it pairs
    it("builds the same chain wherever the book was opened", async () => {
      const chainFor = async (index: number) => {
        mockedBuildUnitChain.mockClear();
        renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );
        await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
        return mockedBuildUnitChain.mock.calls[0];
      };

      expect(await chainFor(0)).toEqual(await chainFor(2));
    });

    // Verify a measured book needs no scan at all
    it("uses the stored measurement instead of scanning", async () => {
      const book = createMockBookWithState({ landscapeBits: "010" });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
          hasPreviews: true,
          book,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      expect(api.getImageDimensions).not.toHaveBeenCalled();
      expect(mockedBuildUnitChain).toHaveBeenCalledWith(
        [false, true, false],
        { isTwoPagedView: true },
        false,
      );
    });

    // Verify bits that cannot describe this book are re-measured rather than trusted
    it("re-measures when the stored bits do not fit the book", async () => {
      const book = createMockBookWithState({ landscapeBits: "01" });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
          hasPreviews: true,
          book,
        }),
      );

      await waitFor(() => expect(api.getImageDimensions).toHaveBeenCalled());
    });

    // Verify a fresh measurement is stored, once, so the next open needs no scan
    it("writes a completed scan back exactly once", async () => {
      const book = createMockBookWithState({ landscapeBits: null });
      vi.mocked(api.getImageDimensions).mockResolvedValue([
        { width: 100, height: 200 },
        { width: 200, height: 100 },
        { width: 100, height: 200 },
      ]);

      const { rerender } = renderHook(
        ({ book }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
            book,
          }),
        { initialProps: { book } },
      );

      await waitFor(() => expect(api.updatePageLayout).toHaveBeenCalledWith(book.id, "010"));

      // The same book arriving as a fresh object — a bookshelf refresh, say — must not
      // make the viewer store the measurement it has already stored.
      rerender({ book: { ...book } });
      await act(async () => {
        await new Promise(process.nextTick);
      });
      expect(vi.mocked(api.updatePageLayout).mock.calls.length).toBe(1);
    });

    // Verify the viewer shows nothing rather than a pairing it would have to correct
    it("publishes no layout while the book is still being measured", async () => {
      vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalled());
      await act(async () => {
        await new Promise(process.nextTick);
      });
      // The pages are loaded; only the decision about how to show them is missing.
      expect(result.current.displayedLayout).toBeNull();
      expect(result.current.isImageLoading).toBe(true);
    });

    // Verify recording a loaded page's shape does not restart the loads still in flight
    it("loads each page of a spread once while the book is being measured", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        let releaseSecond: () => void = () => {};
        const second = new Promise<Image>((resolve) => {
          releaseSecond = () => resolve({} as Image);
        });
        mockedFetchImageBlob.mockImplementation((_path, entry) =>
          entry === "p2.jpg" ? second : Promise.resolve({} as Image),
        );

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockedCreateImageCacheItem).toHaveBeenCalledTimes(1);

        await act(async () => {
          releaseSecond();
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockedCreateImageCacheItem).toHaveBeenCalledTimes(2);
        expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    /** Renders with a never-landing scan and lets the wait cap elapse. */
    const afterTheWaitCap = async (settings: ImageUtils.ViewerSettings, shifted = false) => {
      vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: shifted,
          settings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      return result;
    };

    // Verify a scan that never lands still lets the reader read
    it("pairs from the setting once the wait cap has passed", async () => {
      vi.useFakeTimers();
      try {
        const result = await afterTheWaitCap(twoPaged);

        expect(result.current.displayedLayout).not.toBeNull();
        expect(result.current.isImageLoading).toBe(false);
        // A book that has offered no measurement is paired as one with no landscape page
        // would be, which for most books is already the final answer.
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          { isTwoPagedView: true },
          twoPaged.isFirstPageSingleView,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify a single-page view has nothing to wait for, so it shows the page at once
    it("shows an unmeasured book's page at once in single-page view", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: singlePaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.displayedLayout).not.toBeNull();
        expect(result.current.isImageLoading).toBe(false);

        // The cap passing later neither re-publishes nor reloads the page.
        const before = result.current.displayedLayout;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.displayedLayout).toBe(before);
        expect(mockedFetchImageBlob).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify a single-page view still measures the book for later and leaves the page alone
    it("still stores the measurement in single-page view", async () => {
      vi.useFakeTimers();
      try {
        pairBySetting();
        const book = createMockBookWithState({ landscapeBits: null });
        let land: ((dims: { width: number; height: number }[]) => void) | undefined;
        vi.mocked(api.getImageDimensions).mockReturnValue(
          new Promise((resolve) => {
            land = resolve;
          }),
        );
        // Index 1 starts no unit of a spread chain, so pairing as spreads would move it.
        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 1,
            isSpreadShifted: false,
            settings: singlePaged,
            dispatch: mockDispatch,
            hasPreviews: true,
            book,
          }),
        );
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.displayedLayout).not.toBeNull();

        await act(async () => {
          land?.([
            { width: 100, height: 200 },
            { width: 200, height: 100 },
            { width: 100, height: 200 },
          ]);
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(api.updatePageLayout).toHaveBeenCalledWith(book.id, "010");
        expect(result.current.displayedLayout).not.toBeNull();
        expectNoPageMove();
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify turning spreads on inside the cap keeps the page up and waits, counted from the open
    it("keeps the page on screen when spreads are turned on inside the cap", async () => {
      vi.useFakeTimers();
      try {
        pairBySetting();
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        const { result, rerender } = renderHook(
          ({ settings, index }) =>
            useViewerController({
              containerPath: "path",
              displaySize: VIEWPORT,
              entries: mockEntries,
              index,
              isSpreadShifted: false,
              settings,
              dispatch: mockDispatch,
              hasPreviews: true,
            }),
          { initialProps: { settings: singlePaged, index: 0 } },
        );
        // Visit p2 and come back, so both pages of the spread are cached and the toggle
        // takes the all-cached path.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        rerender({ settings: singlePaged, index: 1 });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        rerender({ settings: singlePaged, index: 0 });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });
        expect(result.current.displayedLayout?.isSpread).toBe(false);

        rerender({ settings: twoPaged, index: 0 });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.displayedLayout?.isSpread).toBe(false);
        expect(result.current.isImageLoading).toBe(true);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });
        expect(result.current.displayedLayout?.isSpread).toBe(true);
        expect(result.current.isImageLoading).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the next unmeasured book waits its own cap, even if the last one's scan never landed
    it("holds the next unmeasured book after the last one's wait cap has passed", async () => {
      vi.useFakeTimers();
      try {
        mockedBuildUnitChain.mockImplementation(spreadPairs);
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        const { result, rerender } = renderHook(
          ({ containerPath, index }) =>
            useViewerController({
              containerPath,
              displaySize: VIEWPORT,
              entries: mockEntries,
              index,
              isSpreadShifted: false,
              settings: twoPaged,
              dispatch: mockDispatch,
              hasPreviews: true,
            }),
          { initialProps: { containerPath: "a", index: 0 } },
        );
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.displayedLayout).not.toBeNull();

        // Index 1 starts no unit of the assumed pairing, so pairing early would move it.
        mockDispatch.mockClear();
        rerender({ containerPath: "b", index: 1 });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.displayedLayout).toBeNull();
        expect(result.current.isImageLoading).toBe(true);
        expectNoPageMove();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.displayedLayout).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the cover setting is what decides the assumed pairing
    it("follows the cover setting while the book is unmeasured", async () => {
      vi.useFakeTimers();
      try {
        await afterTheWaitCap({ ...twoPaged, isFirstPageSingleView: true });
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          { isTwoPagedView: true },
          true,
        );

        mockedBuildUnitChain.mockClear();
        await afterTheWaitCap({ ...twoPaged, isFirstPageSingleView: false });
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          { isTwoPagedView: true },
          false,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the reader's correction still flips the assumed pairing, so the button does
    // something even before the book has been measured
    it("lets the reader's shift flip the assumed pairing", async () => {
      vi.useFakeTimers();
      try {
        await afterTheWaitCap({ ...twoPaged, isFirstPageSingleView: true }, true);
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          { isTwoPagedView: true },
          false,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify a page turn never lands back on a page the reader has just seen
    it("steps by the assumed pairing's own increment", async () => {
      vi.useFakeTimers();
      try {
        // {0,1} {2} for a three-page book: the pairing on screen is a spread, so the
        // page after it is 2. Stepping by one would show page 1 again, on the other
        // side of the screen, and the reader would re-read what they just read.
        mockedBuildUnitChain.mockImplementation(spreadPairs);
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(result.current.displayedLayout?.isSpread).toBe(true);
        result.current.moveForward();
        expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
        expect(mockDispatch).not.toHaveBeenCalledWith(setImageIndex(1));
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify stepping back lands on the unit start, not inside the unit before it
    it("steps back to the assumed pairing's previous unit start", async () => {
      vi.useFakeTimers();
      try {
        mockedBuildUnitChain.mockImplementation(spreadPairs);
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 2,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        result.current.moveBack();
        // Back from {2} is the spread {0,1}, not page 1 on its own.
        expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
        expect(mockDispatch).not.toHaveBeenCalledWith(setImageIndex(1));
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify a landscape page is never shown as half of a spread
    it("never pairs a page it has loaded and found landscape", async () => {
      vi.useFakeTimers();
      try {
        // A landscape image is one physical spread, so it never shares a screen — a fact
        // about that page alone, true whatever the rest of the book turns out to be.
        mockedCreateImageCacheItem.mockReturnValue({
          fullUrl: "url",
          url: "url",
          width: 200,
          height: 100,
        } as ImageUtils.ImageCacheItem);
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        // Let the loaded pages reach the chain. `waitFor` cannot be used here: it polls
        // on a timer that these fake ones never advance.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        // Pages 0 and 1 are the ones on screen, so they are the ones the viewer knows.
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [true, true, false],
          { isTwoPagedView: true },
          twoPaged.isFirstPageSingleView,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the page's own bytes decide its shape, not the stand-in shown before them
    it("measures the page, not its preview", async () => {
      vi.useFakeTimers();
      try {
        // Only the preview arrives, and it reports the opposite orientation. Holding the
        // page back is also what keeps this test from re-entering the load effect.
        mockedCreateImageCacheItem.mockReturnValue({
          previewUrl: "p",
          url: "p",
          width: 200,
          height: 100,
        } as ImageUtils.ImageCacheItem);
        vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue({} as Image);
        mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: { ...twoPaged, enablePreview: true },
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        // A preview is rendered at whatever size its format chose; the page it stands in
        // for is the only thing that says how that page is shaped.
        const seen = mockedBuildUnitChain.mock.calls.map((call) => call[0]);
        expect(seen).toContainEqual([false, false, false]);
        expect(seen.some((landscape) => landscape.includes(true))).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify a page it has not seen is assumed portrait rather than guessed at
    it("takes an unloaded page for portrait", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        // Nothing loads, so nothing is known.
        mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));

        await afterTheWaitCap(twoPaged);

        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          { isTwoPagedView: true },
          twoPaged.isFirstPageSingleView,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the parity is never taken from a page set the viewer has only half seen
    it("never reads cover presence from a partly loaded book", async () => {
      vi.useFakeTimers();
      try {
        mockedDetectCoverPresence.mockReturnValue(!twoPaged.isFirstPageSingleView);
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));

        await afterTheWaitCap(twoPaged);

        // Detection counts the pages before a landscape image to fix the parity, so an
        // unloaded landscape page earlier in the book flips its answer. The setting is
        // the only thing that can be trusted here.
        expect(mockedDetectCoverPresence).not.toHaveBeenCalled();
        expect(
          mockedBuildUnitChain.mock.calls.every(
            (call) => call[2] === twoPaged.isFirstPageSingleView,
          ),
        ).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the reported wait spans the hold, not just the render that ended it
    it("times the display from when the reader asked for the page", async () => {
      vi.useFakeTimers();
      try {
        // The measurement lands late, so the layout effect runs twice: once that shows
        // nothing, and once — triggered by the chain — that publishes. A span started in
        // the second run would report the render and miss the wait the reader sat through.
        let land: ((dims: { width: number; height: number }[]) => void) | undefined;
        vi.mocked(api.getImageDimensions).mockReturnValue(
          new Promise((resolve) => {
            land = resolve;
          }),
        );

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(perfLog.perf).not.toHaveBeenCalledWith(
          "display",
          expect.anything(),
          expect.anything(),
        );
        // Every clock the hook has taken so far. The reader waits from here on.
        const takenBeforeTheWait = vi.mocked(perfLog.perfStart).mock.calls.length;

        land?.(mockEntries.map(() => ({ width: 100, height: 200 })));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        // The wait may not be restarted by the render that ends it: no new clock was
        // taken between the reader asking for the page and being shown one.
        expect(vi.mocked(perfLog.perfStart).mock.calls.length).toBe(takenBeforeTheWait);

        const displays = vi.mocked(perfLog.perf).mock.calls.filter(([op]) => op === "display");
        expect(displays).toHaveLength(1);
        expect(displays[0][2]).toBe(1234);
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify an assumed pairing is never mistaken for a measurement
    it("never stores the assumed pairing as a measurement", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        renderHook(() =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
            book: createMockBookWithState({ landscapeBits: null }),
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        // It is a display decision, not something measured about the book.
        expect(api.updatePageLayout).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    // Verify the reader's own correction, not their position, decides the pairing
    it("never infers the shift from where the book was opened", async () => {
      mockedBuildUnitChain.mockReturnValue({
        starts: [0, 1],
        units: new Map([
          [0, { isSpread: false, nextIndexIncrement: 1 }],
          [1, { isSpread: true, nextIndexIncrement: 2 }],
        ]),
      });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      // Index 2 sits inside the spread starting at 1, so the viewer snaps to it rather
      // than concluding the reader must have shifted the book.
      await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1)));
      expect(mockedBuildUnitChain.mock.calls.map((call) => call[2])).not.toContain(true);
    });

    // Verify the reading direction and the preload count leave the pairing and the page
    // being loaded alone
    it.each([
      { change: "direction", settings: { ...twoPaged, direction: "rtl" as const } },
      { change: "preload count", settings: { ...twoPaged, preloadPageCount: 3 } },
    ])(
      "keeps the pairing and the load in flight when the $change changes",
      async ({ settings }) => {
        mockedBuildUnitChain.mockImplementation(spreadPairs);
        const page = heldFetch();
        mockedFetchImageBlob.mockReturnValue(page.promise);
        // Measured, so the chain exists from the first render and both pages are fetched
        // once the viewport is reported.
        const book = createMockBookWithState({ landscapeBits: "000" });
        const { result, rerender } = renderHook(
          ({ settings }) =>
            useViewerController({
              containerPath: "path",
              book,
              displaySize: VIEWPORT,
              entries: mockEntries,
              index: 0,
              isSpreadShifted: false,
              settings,
              dispatch: mockDispatch,
              hasPreviews: true,
            }),
          { initialProps: { settings: twoPaged } },
        );
        await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2));
        const builds = mockedBuildUnitChain.mock.calls.length;

        rerender({ settings });
        await act(async () => {
          await new Promise(process.nextTick);
        });

        expect(mockedBuildUnitChain.mock.calls.length).toBe(builds);
        expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2);
        page.deliver();
        await waitFor(() => expect(result.current.displayedLayout?.isSpread).toBe(true));
      },
    );

    // Verify the preview setting decides what is loaded, not how the book pairs
    it("keeps the pairing when previews are turned on", async () => {
      const { result, rerender } = renderHook(
        ({ settings }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { settings: twoPaged } },
      );
      // Settled: the viewport reported, the book measured and its page shown.
      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      const builds = mockedBuildUnitChain.mock.calls.length;

      rerender({ settings: { ...twoPaged, enablePreview: true } });
      await act(async () => {
        await new Promise(process.nextTick);
      });

      expect(mockedBuildUnitChain.mock.calls.length).toBe(builds);
    });

    // Verify a setting that does decide the pairing still rebuilds it (guard)
    it("re-pairs when the cover setting changes", async () => {
      const { result, rerender } = renderHook(
        ({ settings }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { settings: twoPaged } },
      );
      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      mockedBuildUnitChain.mockClear();

      rerender({ settings: { ...twoPaged, isFirstPageSingleView: true } });

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          expect.objectContaining({ isTwoPagedView: true }),
          true,
        ),
      );
    });

    // Verify a book is written back again when it is reopened still unmeasured
    it("stores a reopened book's measurement after visiting an already-measured book", async () => {
      const bookA = createMockBookWithState({ id: 1, landscapeBits: null });
      const bookB = createMockBookWithState({ id: 2, landscapeBits: "000" });
      vi.mocked(api.updatePageLayout).mockRejectedValueOnce(new Error("database is locked"));
      const { rerender } = renderHook(
        ({ containerPath, book }) =>
          useViewerController({
            containerPath,
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            hasPreviews: true,
            book,
          }),
        { initialProps: { containerPath: "a", book: bookA } },
      );
      await waitFor(() => expect(api.updatePageLayout).toHaveBeenCalledTimes(1));

      rerender({ containerPath: "b", book: bookB });
      rerender({ containerPath: "a", book: bookA });

      await waitFor(() => expect(api.updatePageLayout).toHaveBeenCalledTimes(2));
      expect(api.updatePageLayout).toHaveBeenLastCalledWith(1, "000");
    });
  });

  describe("preview loading", () => {
    // Verify that preview image acquisition is performed if preview is enabled
    it("should load preview when enabled", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        previewUrl: "p",
        fullUrl: "f",
        url: "p",
      } as ImageUtils.ImageCacheItem);

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: settingsWithPreview,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      await waitFor(() => {
        expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled();
      });
    });

    // Verify that race conditions between preview and full image acquisition (preview arrives later) are handled correctly
    it("should handle update of existing cache item with preview (race condition)", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };

      // Delay preview image fetch
      let resolvePreview: ((val: Image) => void) | undefined;
      const previewPromise = new Promise<Image>((resolve) => {
        resolvePreview = resolve;
      });
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockReturnValue(previewPromise);

      // Full image fetch resolves immediately
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      // First call (full) returns item with fullUrl
      mockedCreateImageCacheItem.mockReturnValueOnce({
        fullUrl: "f_url",
        url: "f_url",
      } as ImageUtils.ImageCacheItem);
      // Second call (preview) returns item with previewUrl
      mockedCreateImageCacheItem.mockReturnValueOnce({
        previewUrl: "p_url",
        url: "p_url",
      } as ImageUtils.ImageCacheItem);

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: settingsWithPreview,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      // Wait for full image to be processed and cached
      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalled());

      // Now resolve preview
      resolvePreview?.({} as Image);

      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());
      // Wait for state updates to settle
      await act(async () => {
        await new Promise(process.nextTick);
      });
    });

    // Verify that race conditions between preview and full image acquisition (full image arrives later) are handled correctly
    it("should handle update of existing cache item (loading full after preview)", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };

      // Delay full image fetch
      let resolveFull: ((val: Image) => void) | undefined;
      const fullPromise = new Promise<Image>((resolve) => {
        resolveFull = resolve;
      });
      mockedFetchImageBlob.mockReturnValue(fullPromise);
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue({} as Image);

      // First call (preview) returns item with previewUrl
      mockedCreateImageCacheItem.mockReturnValueOnce({
        previewUrl: "p_url",
        url: "p_url",
      } as ImageUtils.ImageCacheItem);
      // Second call (full) returns item with fullUrl
      mockedCreateImageCacheItem.mockReturnValueOnce({
        fullUrl: "f_url",
        url: "f_url",
      } as ImageUtils.ImageCacheItem);

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: settingsWithPreview,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

      // Wait for everything to finish
      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalled());
      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());

      // Now resolve full image
      resolveFull?.({} as Image);

      // Wait a bit more to ensure all promises in updateLayout finished
      await act(async () => {
        await new Promise(process.nextTick);
      });
    });

    // Only PDF can build a preview more cheaply than the page it stands in for; the open
    // says so, and any other book is not asked at all.
    it("does not ask for previews when the book has none", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "f",
        url: "f",
      } as ImageUtils.ImageCacheItem);

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: { ...mockSettings, enablePreview: true },
          dispatch: mockDispatch,
          hasPreviews: false,
        }),
      );

      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalled());
      expect(ImageUtils.fetchImagePreviewBlob).not.toHaveBeenCalled();
    });

    // An empty answer means the page was already cached, not that the book has no previews
    it("keeps asking for previews after an empty preview answer", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue(null);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "f",
        url: "f",
      } as ImageUtils.ImageCacheItem);

      const { rerender } = renderHook(
        ({ index }: { index: number }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: { ...mockSettings, enablePreview: true },
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());
      const afterFirstPage = vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length;

      rerender({ index: 2 });
      await waitFor(() =>
        expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalledWith(
          "path",
          "p3.jpg",
          expect.any(Number),
        ),
      );
      expect(vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length).toBeGreaterThan(
        afterFirstPage,
      );
    });

    // A failed request says nothing about the container, so it must not disable previews.
    it("keeps requesting previews after a failed request", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockRejectedValue(
        new CommandError(ErrorCode.io, "preview failed"),
      );
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "f",
        url: "f",
      } as ImageUtils.ImageCacheItem);

      const { rerender } = renderHook(
        ({ index }: { index: number }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: settingsWithPreview,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());
      const afterFirstPage = vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length;

      rerender({ index: 1 });
      await waitFor(() =>
        expect(vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length).toBeGreaterThan(
          afterFirstPage,
        ),
      );
    });

    it("gives a run's previews and pages one generation, and a later run a greater one", async () => {
      const spreadWithPreview: ImageUtils.ViewerSettings = {
        ...mockSettings,
        isTwoPagedView: true,
        enablePreview: true,
      };
      mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockReturnValue(new Promise(() => {}));

      const { rerender } = renderHook(
        ({ index }: { index: number }) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: spreadWithPreview,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => {
        expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2);
        expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalledTimes(2);
      });

      const firstRunGenerations = [
        ...mockedFetchImageBlob.mock.calls.map((call) => call[2]),
        ...vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.map((call) => call[2]),
      ];
      expect(typeof firstRunGenerations[0]).toBe("number");
      expect(new Set(firstRunGenerations).size).toBe(1);

      rerender({ index: 2 });
      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalledTimes(3));

      expect(mockedFetchImageBlob.mock.calls[2][2]).toBeGreaterThan(firstRunGenerations[0]);
    });
  });

  // The backend leaves the caller's own pages out of the preload window, so the viewer has
  // to say how many it is fetching itself.
  describe("preload window", () => {
    const renderAt = (settings: ImageUtils.ViewerSettings, index: number) =>
      renderHook(() =>
        useViewerController({
          containerPath: "path",
          displaySize: VIEWPORT,
          entries: mockEntries,
          index,
          isSpreadShifted: false,
          settings,
          dispatch: mockDispatch,
          hasPreviews: true,
        }),
      );

    it("names one page in single-page view", async () => {
      renderAt(mockSettings, 0);

      await waitFor(() => expect(api.requestPreloadAround).toHaveBeenCalledWith("path", 0, 10, 1));
    });

    it("names both pages in spread view", async () => {
      renderAt({ ...mockSettings, isTwoPagedView: true }, 0);

      await waitFor(() => expect(api.requestPreloadAround).toHaveBeenCalledWith("path", 0, 10, 2));
    });

    // The last page has nothing beside it, so the viewer loads one page there whatever the
    // setting says — and preload must not be told to skip a page that follows the book.
    it("names one page on the last page of a spread book", async () => {
      renderAt({ ...mockSettings, isTwoPagedView: true }, mockEntries.length - 1);

      await waitFor(() =>
        expect(api.requestPreloadAround).toHaveBeenCalledWith(
          "path",
          mockEntries.length - 1,
          10,
          1,
        ),
      );
    });

    it("asks the backend to preload once a burst of page turns settles", async () => {
      vi.useFakeTimers();
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      try {
        const { rerender } = renderHook(
          ({ index }: { index: number }) =>
            useViewerController({
              containerPath: "path",
              displaySize: VIEWPORT,
              entries: mockEntries,
              index,
              isSpreadShifted: false,
              settings: mockSettings,
              dispatch: mockDispatch,
              hasPreviews: true,
            }),
          { initialProps: { index: 0 } },
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(ImageUtils.fetchImageBlob).toHaveBeenCalled();

        rerender({ index: 1 });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        rerender({ index: 2 });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(99);
        });
        expect(api.requestPreloadAround).not.toHaveBeenCalled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
        expect(api.requestPreloadAround).toHaveBeenCalledTimes(1);
        expect(api.requestPreloadAround).toHaveBeenCalledWith("path", 2, 10, 1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("sends no preload request when unmounted before it settles", async () => {
      vi.useFakeTimers();
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      try {
        const { unmount } = renderHook(
          ({ index }: { index: number }) =>
            useViewerController({
              containerPath: "path",
              displaySize: VIEWPORT,
              entries: mockEntries,
              index,
              isSpreadShifted: false,
              settings: mockSettings,
              dispatch: mockDispatch,
              hasPreviews: true,
            }),
          { initialProps: { index: 0 } },
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(ImageUtils.fetchImageBlob).toHaveBeenCalled();

        unmount();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });
        expect(api.requestPreloadAround).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("the reader's viewport", () => {
    beforeEach(() => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      urlPerLoad();
    });

    const renderAtSize = (displaySize: DisplaySize) =>
      renderHook(
        ({ size }: { size: DisplaySize }) =>
          useViewerController({
            containerPath: "path",
            displaySize: size,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: mockSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { size: displaySize } },
      );

    it("loads nothing before the viewport has been measured", async () => {
      renderAtSize({ width: 0, height: 0 });

      // A page fetched now would arrive at its stored size and be fetched again at the
      // right one, so the viewer waits instead.
      await waitFor(() => expect(api.getImageDimensions).toHaveBeenCalled());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      expect(api.setDisplaySize).not.toHaveBeenCalled();
      expect(ImageUtils.fetchImageBlob).not.toHaveBeenCalled();
      expect(api.requestPreloadAround).not.toHaveBeenCalled();
    });

    it("waits for the backend to have the viewport before asking for a page", async () => {
      // Not merely called first: a page asked for while this is in flight is rendered
      // for whatever viewport the backend still had, and fetched again after.
      let acknowledge: () => void = () => {};
      vi.mocked(api.setDisplaySize).mockReturnValueOnce(
        new Promise((resolve) => {
          acknowledge = () => {
            resolve(null);
          };
        }),
      );

      const { result } = renderAtSize(VIEWPORT);

      await waitFor(() =>
        expect(api.setDisplaySize).toHaveBeenCalledWith(VIEWPORT.width, VIEWPORT.height),
      );
      expect(ImageUtils.fetchImageBlob).not.toHaveBeenCalled();
      // And the reader is told it is waiting, because it is.
      expect(result.current.isImageLoading).toBe(true);

      act(() => {
        acknowledge();
      });
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalled());
    });

    it("waits for the backend to have the viewport before asking it to preload", async () => {
      let acknowledge: () => void = () => {};
      vi.mocked(api.setDisplaySize).mockReturnValueOnce(
        new Promise((resolve) => {
          acknowledge = () => {
            resolve(null);
          };
        }),
      );

      renderAtSize(VIEWPORT);

      // A preload that lands first fills the cache with pages rendered for whatever
      // viewport the backend still had, and the next page turn misses on every one.
      await waitFor(() =>
        expect(api.setDisplaySize).toHaveBeenCalledWith(VIEWPORT.width, VIEWPORT.height),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      expect(api.requestPreloadAround).not.toHaveBeenCalled();

      act(() => {
        acknowledge();
      });
      await waitFor(() => expect(api.requestPreloadAround).toHaveBeenCalledTimes(1));
    });

    it("re-fetches the current page when the viewport changes", async () => {
      const { rerender } = renderAtSize(VIEWPORT);
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(1));

      rerender({ size: { width: 2048, height: 1536 } });

      await waitFor(() => expect(api.setDisplaySize).toHaveBeenCalledWith(2048, 1536));
      // The cached blob URL is a page rendered for the old viewport: nothing would
      // reload it, because the backend keys a page by the box it was fitted into.
      await waitFor(() => expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0"));
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(2));
    });

    it("preloads again when the viewport changes", async () => {
      const { rerender } = renderAtSize(VIEWPORT);
      await waitFor(() => expect(api.requestPreloadAround).toHaveBeenCalledTimes(1));

      rerender({ size: { width: 2048, height: 1536 } });

      // The pages around this one are wanted at the new size too, and asking is also
      // what makes the backend drop the preload jobs still queued for the old one.
      await waitFor(() => expect(api.requestPreloadAround).toHaveBeenCalledTimes(2));
    });

    it("keeps the page when the viewport is re-rendered at the same size", async () => {
      const { rerender } = renderAtSize(VIEWPORT);
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(1));

      rerender({ size: VIEWPORT });

      await waitFor(() => expect(api.setDisplaySize).toHaveBeenCalledTimes(1));
      expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(1);
    });

    it("still shows a page when the viewport cannot be reported", async () => {
      vi.mocked(api.setDisplaySize).mockRejectedValueOnce(new Error("the book was closed"));
      renderAtSize(VIEWPORT);

      // The backend still has whatever viewport it was last told, so a page rendered for
      // that beats no page at all.
      await waitFor(() => expect(warn).toHaveBeenCalled());
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalled());
      // And the cache is kept, because it matches what the backend would serve.
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    const renderAt = (props: { size: DisplaySize; index: number; path?: string }) =>
      renderHook(
        ({ size, index, path }: { size: DisplaySize; index: number; path?: string }) =>
          useViewerController({
            containerPath: path ?? "path",
            displaySize: size,
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: mockSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: props },
      );

    it("keeps the page on screen through a viewport change until its replacement is shown", async () => {
      const replacement = heldFetch();
      mockedFetchImageBlob
        .mockResolvedValueOnce({} as Image)
        .mockResolvedValueOnce({} as Image)
        .mockReturnValueOnce(replacement.promise);
      const { result, rerender } = renderAt({ size: VIEWPORT, index: 0 });
      await waitFor(() =>
        expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:0"),
      );
      rerender({ size: VIEWPORT, index: 1 });
      await waitFor(() =>
        expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:1"),
      );

      rerender({ size: WIDER, index: 1 });
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(3));
      // Off screen, nothing shows it again.
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
      // On screen until the page rendered for the new size replaces it.
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:1");

      act(() => {
        replacement.deliver();
      });
      await waitFor(() =>
        expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:2"),
      );
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    });

    it("revokes a page held on screen when the book changes", async () => {
      mockedFetchImageBlob
        .mockResolvedValueOnce({} as Image)
        .mockReturnValueOnce(heldFetch().promise);
      const { result, rerender } = renderAt({ size: VIEWPORT, index: 0 });
      await waitFor(() =>
        expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:0"),
      );
      rerender({ size: WIDER, index: 0 });
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(2));
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:0");

      rerender({ size: WIDER, index: 0, path: "other" });

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
    });

    it("revokes a page held on screen when the reader unmounts", async () => {
      mockedFetchImageBlob
        .mockResolvedValueOnce({} as Image)
        .mockReturnValueOnce(heldFetch().promise);
      const { result, rerender, unmount } = renderAt({ size: VIEWPORT, index: 0 });
      await waitFor(() =>
        expect(result.current.displayedLayout?.firstImage?.fullUrl).toBe("blob:0"),
      );
      rerender({ size: WIDER, index: 0 });
      await waitFor(() => expect(ImageUtils.fetchImageBlob).toHaveBeenCalledTimes(2));
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:0");

      unmount();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
    });
  });

  describe("switching books", () => {
    const twoPaged: ImageUtils.ViewerSettings = { ...mockSettings, isTwoPagedView: true };

    const renderBook = (settings = mockSettings) =>
      renderHook(
        ({ containerPath, entries }) =>
          useViewerController({
            containerPath,
            displaySize: VIEWPORT,
            entries,
            index: 0,
            isSpreadShifted: false,
            settings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { containerPath: "a", entries: mockEntries } },
      );

    // Verify a book reopened before the next one loaded does not show its old, revoked page
    it("shows nothing of a book reopened before the next one loads", async () => {
      urlPerLoad();
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      const { result, rerender } = renderBook();
      await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());

      mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
      rerender({ containerPath: "b", entries: [] });
      rerender({ containerPath: "a", entries: [] });

      expect(result.current.displayedLayout).toBeNull();
    });

    // Verify the next book's open is not shown as a page still loading
    it("clears the loading state while the next book opens", async () => {
      mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
      const { result, rerender } = renderBook();
      // A's page is in flight: the viewport has been reported and the fetch made.
      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalledTimes(1));
      expect(result.current.isImageLoading).toBe(true);
      const fetches = mockedFetchImageBlob.mock.calls.length;

      rerender({ containerPath: "b", entries: [] });

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      expect(mockedFetchImageBlob.mock.calls.length).toBe(fetches);
    });

    // Verify the display is timed from when the book's pages are known
    it("times the next book's display from when its pages arrive", async () => {
      let clock = 0;
      vi.mocked(perfLog.perfStart).mockImplementation(() => ++clock);
      vi.mocked(perfLog.perfSince).mockImplementation((started) => started);
      try {
        urlPerLoad();
        mockedFetchImageBlob.mockResolvedValue({} as Image);
        const { rerender } = renderBook();
        rerender({ containerPath: "b", entries: [] });
        await act(async () => {
          await new Promise(process.nextTick);
        });
        const beforePages = clock;
        vi.mocked(perfLog.perf).mockClear();

        rerender({ containerPath: "b", entries: ["b1", "b2", "b3"] });

        await waitFor(() =>
          expect(vi.mocked(perfLog.perf)).toHaveBeenCalledWith(
            "display",
            expect.anything(),
            expect.anything(),
          ),
        );
        const display = vi.mocked(perfLog.perf).mock.calls.find(([op]) => op === "display");
        expect(display?.[2]).toBeGreaterThan(beforePages);
      } finally {
        vi.mocked(perfLog.perfStart).mockImplementation(() => 0);
        vi.mocked(perfLog.perfSince).mockImplementation((started) =>
          started === null ? null : 1234,
        );
      }
    });

    // Verify the wait for the measurement starts when the book's pages are known, not while
    // the book is still opening
    it("starts the measurement wait once the next book's pages arrive", async () => {
      vi.useFakeTimers();
      try {
        urlPerLoad();
        mockedFetchImageBlob.mockResolvedValue({} as Image);
        mockedBuildUnitChain.mockImplementation(spreadPairs);
        vi.mocked(api.getImageDimensions).mockReturnValue(new Promise(() => {}));
        const { result, rerender } = renderBook(twoPaged);
        rerender({ containerPath: "b", entries: [] });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        rerender({ containerPath: "b", entries: mockEntries });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.displayedLayout).toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.displayedLayout).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("decoding before display", () => {
    const entries = ["p0.jpg", "p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"];
    const twoPaged: ImageUtils.ViewerSettings = { ...mockSettings, isTwoPagedView: true };

    /** A decode that resolves when the test says so. */
    const heldDecode = () => {
      let release: () => void = () => {};
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release };
    };

    beforeEach(() => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      urlPerLoad();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Verify a spread waits for both its pages to be decoded, so they appear together
    it("does not show a spread until both its pages are decoded", async () => {
      mockScan(6);
      mockedBuildUnitChain.mockImplementation(spreadPairs);
      const held = heldDecode();
      const decode = vi.spyOn(HTMLImageElement.prototype, "decode").mockImplementation(function (
        this: HTMLImageElement,
      ) {
        return this.getAttribute("src") === "blob:0" ? held.promise : Promise.resolve();
      });
      const { result } = renderMoves(0, { entries, settings: twoPaged });

      await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current.displayedLayout).toBeNull();

      held.release();
      await waitFor(() => expect(result.current.displayedLayout?.isSpread).toBe(true));
    });

    // Verify the decoded images are let go once their pages are on screen
    it("releases the decoded images of the pages it shows", async () => {
      mockScan(6);
      mockedBuildUnitChain.mockImplementation(spreadPairs);
      const { result } = renderMoves(0, { entries, settings: twoPaged });

      await waitFor(() => expect(result.current.displayedLayout?.isSpread).toBe(true));
      expect(result.current.displayedLayout?.firstImage?.decoded).toBeUndefined();
      expect(result.current.displayedLayout?.secondImage?.decoded).toBeUndefined();
      expect(mockedCreateImageCacheItem).toHaveBeenCalledTimes(2);
    });

    // Verify a page decoded after its book was left is neither shown nor kept
    it("shows nothing of a book left during a decode", async () => {
      const held = heldDecode();
      vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(held.promise);
      const { result, rerender } = renderHook(
        ({ containerPath }) =>
          useViewerController({
            containerPath,
            displaySize: VIEWPORT,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: mockSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
          }),
        { initialProps: { containerPath: "a" } },
      );
      await waitFor(() => expect(mockedCreateImageCacheItem).toHaveBeenCalled());

      mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
      rerender({ containerPath: "b" });
      held.release();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.displayedLayout).toBeNull();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
    });
  });

  describe("loading ahead", () => {
    /** Renders a book of `count` pages, measured as portrait unless `measured` is false. */
    const renderAhead = (
      count: number,
      props: Partial<ViewerControllerOptions> = {},
      measured = true,
    ) => {
      const entries = Array.from({ length: count }, (_, i) => `p${i}.jpg`);
      if (measured) {
        mockScan(count);
      }
      return renderHook(
        (p: Partial<ViewerControllerOptions>) =>
          useViewerController({
            containerPath: "path",
            displaySize: VIEWPORT,
            entries,
            index: 0,
            isSpreadShifted: false,
            settings: mockSettings,
            dispatch: mockDispatch,
            hasPreviews: true,
            ...p,
          }),
        { initialProps: props },
      );
    };
    /** The fetches of `entry`'s full page for `path`; a call's generation is `[2]`. */
    const fetched = (entry: string, path = "path") =>
      mockedFetchImageBlob.mock.calls.filter(([p, e]) => p === path && e === entry);
    /** Waits past the preload delay. */
    const pastDelay = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

    beforeEach(() => {
      vi.mocked(pagesAhead).mockImplementation(realPagesAhead);
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      urlPerLoad();
    });

    afterEach(() => {
      mockedFetchImageBlob.mockReset();
    });

    // Verify the pages ahead are fetched one by one in the run's generation, after the
    // current page, so the backend never cancels the current page for them
    it("loads the next two pages with the current page's generation, one at a time", async () => {
      const held = heldFetch();
      mockedFetchImageBlob.mockImplementation((_, entry) =>
        entry === "p1.jpg" ? held.promise : Promise.resolve({} as Image),
      );
      renderAhead(6);

      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(1));
      const generation = fetched("p0.jpg")[0][2];
      expect(fetched("p1.jpg")[0][2]).toBe(generation);
      expect(fetched("p2.jpg")).toHaveLength(0);

      act(() => held.deliver());
      await waitFor(() => expect(fetched("p2.jpg")).toHaveLength(1));
      expect(fetched("p2.jpg")[0][2]).toBe(generation);
      await pastDelay();
      expect(fetched("p3.jpg")).toHaveLength(0);
    });

    // Verify a spread's preload covers both pages of each of the next two spreads
    it("loads both pages of the next two spreads", async () => {
      mockedBuildUnitChain.mockImplementation(spreadPairs);
      renderAhead(8, { settings: { ...mockSettings, isTwoPagedView: true } });

      await waitFor(() => expect(fetched("p5.jpg")).toHaveLength(1));
      expect(mockedFetchImageBlob.mock.calls.slice(2).map(([, entry]) => entry)).toEqual([
        "p2.jpg",
        "p3.jpg",
        "p4.jpg",
        "p5.jpg",
      ]);
      await pastDelay();
      expect(fetched("p6.jpg")).toHaveLength(0);
    });

    // Verify the preload never competes with the page the reader is waiting for
    it("loads nothing ahead before the current page is shown", async () => {
      const held = heldFetch();
      mockedFetchImageBlob.mockImplementation((_, entry) =>
        entry === "p0.jpg" ? held.promise : Promise.resolve({} as Image),
      );
      renderAhead(6);

      await pastDelay();
      expect(mockedFetchImageBlob).toHaveBeenCalledTimes(1);

      act(() => held.deliver());
      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(1));
    });

    // Verify a turn shows the loaded-ahead page from the cache and loads on past it
    it("turns to a loaded-ahead page without fetching it, and loads on from there", async () => {
      const { result, rerender } = renderAhead(6);

      await waitFor(() =>
        expect(mockedCreateImageCacheItem.mock.results[2]?.value.decoded).toBeDefined(),
      );
      const p1Item = mockedCreateImageCacheItem.mock.results[1]?.value;
      expect(p1Item.decoded).toBeDefined();

      rerender({ index: 1 });
      expect(result.current.displayedLayout?.firstImage).toBe(p1Item);
      expect(result.current.displayedLayout?.firstImage?.decoded).toBeUndefined();
      await waitFor(() => expect(fetched("p3.jpg")).toHaveLength(1));
      expect(fetched("p3.jpg")[0][2]).toBeGreaterThan(fetched("p1.jpg")[0][2]);
      expect(fetched("p1.jpg")).toHaveLength(1);
      expect(fetched("p2.jpg")).toHaveLength(1);
    });

    // Verify a jump before the delay ends sends nothing ahead of the page left
    it("stops the preload when the reader jumps during the delay", async () => {
      const { result, rerender } = renderAhead(10);

      await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());
      rerender({ index: 5 });
      await waitFor(() => expect(fetched("p6.jpg")).toHaveLength(1));
      expect(fetched("p1.jpg")).toHaveLength(0);
      expect(fetched("p2.jpg")).toHaveLength(0);
    });

    // Verify a jump while a page ahead is in flight stops the rest of that preload
    it("stops the preload when the reader jumps during a fetch ahead", async () => {
      const held = heldFetch();
      mockedFetchImageBlob.mockImplementation((_, entry) =>
        entry === "p1.jpg" ? held.promise : Promise.resolve({} as Image),
      );
      const { rerender } = renderAhead(10);

      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(1));
      rerender({ index: 5 });
      act(() => held.deliver());
      await waitFor(() => expect(fetched("p7.jpg")).toHaveLength(1));
      expect(fetched("p2.jpg")).toHaveLength(0);
    });

    // Verify the pages loaded ahead and then jumped past do not keep their decoded images
    it("releases the decoded images of pages it jumped past", async () => {
      const { rerender } = renderAhead(10);

      await waitFor(() =>
        expect(mockedCreateImageCacheItem.mock.results[2]?.value.decoded).toBeDefined(),
      );
      const p1Item = mockedCreateImageCacheItem.mock.results[1]?.value;
      const p2Item = mockedCreateImageCacheItem.mock.results[2]?.value;
      expect(p1Item.decoded).toBeDefined();

      rerender({ index: 4 });
      await waitFor(() => expect(fetched("p5.jpg")).toHaveLength(1));
      expect(p1Item.decoded).toBeUndefined();
      expect(p2Item.decoded).toBeUndefined();
    });

    // Verify a resize drops the preload for the old viewport and preloads for the new one
    it("stops the preload when the viewport changes", async () => {
      const held = heldFetch();
      let p1Fetches = 0;
      mockedFetchImageBlob.mockImplementation((_, entry) =>
        entry === "p1.jpg" && p1Fetches++ === 0 ? held.promise : Promise.resolve({} as Image),
      );
      const { rerender } = renderAhead(6);

      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(1));
      const first = fetched("p1.jpg")[0][2];
      rerender({ displaySize: WIDER });
      await waitFor(() => expect(fetched("p0.jpg")).toHaveLength(2));
      act(() => held.deliver());
      await waitFor(() => expect(fetched("p2.jpg")).toHaveLength(1));
      expect(fetched("p2.jpg")[0][2]).toBeGreaterThan(first);
    });

    // Verify an unmeasured book's assumed pairing is never preloaded
    it("loads nothing ahead of an unmeasured book until it is measured", async () => {
      let resolveScan: (pages: { width: number; height: number }[]) => void = () => {};
      const scan = new Promise<{ width: number; height: number }[]>((resolve) => {
        resolveScan = resolve;
      });
      vi.mocked(api.getImageDimensions).mockReturnValue(scan);
      const { result } = renderAhead(6, {}, false);

      await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());
      await pastDelay();
      expect(mockedFetchImageBlob).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveScan(Array.from({ length: 6 }, () => ({ width: 100, height: 200 })));
      });
      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(1));
    });

    // Verify a preload count of zero turns the viewer's own loading ahead off too
    it("loads nothing ahead when preloading is off", async () => {
      const { result } = renderAhead(6, { settings: { ...mockSettings, preloadPageCount: 0 } });

      await waitFor(() => expect(result.current.displayedLayout).not.toBeNull());
      await pastDelay();
      expect(mockedFetchImageBlob).toHaveBeenCalledTimes(1);
    });

    // Verify the preload stops at the end of the book
    it("loads only the last page ahead one page before the end", async () => {
      renderAhead(3, { index: 1 });

      await waitFor(() => expect(fetched("p2.jpg")).toHaveLength(1));
      await pastDelay();
      expect(mockedFetchImageBlob).toHaveBeenCalledTimes(2);
    });

    // Verify a page that failed ahead is not shown as an error and is asked for again
    it("shows no error for a failed preload and fetches the page again when reached", async () => {
      let p1Fetches = 0;
      mockedFetchImageBlob.mockImplementation((_, entry) =>
        entry === "p1.jpg" && p1Fetches++ === 0
          ? Promise.reject(new CommandError(ErrorCode.io, "x"))
          : Promise.resolve({} as Image),
      );
      const { result, rerender } = renderAhead(6);

      await waitFor(() => expect(fetched("p2.jpg")).toHaveLength(1));
      expect(result.current.displayedLayout?.firstError).toBeUndefined();
      rerender({ index: 1 });
      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(2));
    });

    // Verify the preload asks for full pages only
    it("loads no preview ahead", async () => {
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockImplementation(
        (_, isPreview) =>
          (isPreview
            ? { previewUrl: "blob:p", url: "blob:p" }
            : { fullUrl: "blob:f", url: "blob:f" }) as ImageUtils.ImageCacheItem,
      );
      renderAhead(6, { settings: { ...mockSettings, enablePreview: true } });

      await waitFor(() => expect(fetched("p2.jpg")).toHaveLength(1));
      for (const [, entry] of vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls) {
        expect(entry).toBe("p0.jpg");
      }
    });

    // Verify opening another book stops the preload of the book left
    it("stops the preload when another book opens", async () => {
      const held = heldFetch();
      mockedFetchImageBlob.mockImplementation((_, entry) =>
        entry === "p1.jpg" ? held.promise : Promise.resolve({} as Image),
      );
      const { rerender } = renderAhead(6);

      await waitFor(() => expect(fetched("p1.jpg")).toHaveLength(1));
      rerender({ containerPath: "other" });
      act(() => held.deliver());
      await waitFor(() => expect(fetched("p1.jpg", "other")).toHaveLength(1));
      expect(fetched("p2.jpg")).toHaveLength(0);
    });
  });
});
