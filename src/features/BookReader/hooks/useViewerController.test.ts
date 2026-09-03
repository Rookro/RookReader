import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePageLayout } from "../../../bindings/BookCommands";
import { getImageDimensions, requestPreloadAround } from "../../../bindings/ContainerCommands";
import { createMockBookWithState } from "../../../test/factories";
import type { Image } from "../../../types/Image";
import * as perfLog from "../../../utils/perf";
import { setImageIndex, setSpreadDisplayed } from "../slice";
import * as ImageUtils from "../utils/ImageUtils";
import { useViewerController } from "./useViewerController";

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
  buildSinglePageLayout: vi.fn((firstImage) => ({
    firstImage,
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
    ) => {
      const firstImage = cache.get(entries[currentIndex]);
      if (!firstImage) {
        return null;
      }
      if (!unit.isSpread) {
        return { firstImage, isSpread: false, nextIndexIncrement: unit.nextIndexIncrement };
      }
      const secondImage = cache.get(entries[currentIndex + 1]);
      if (!secondImage) {
        return null;
      }
      return {
        firstImage,
        secondImage,
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

  /** Makes the dimension scan report `count` portrait pages. */
  const mockScan = (count: number) => {
    vi.mocked(getImageDimensions).mockResolvedValue(
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

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.revokeObjectURL = vi.fn();
    // The viewer holds its layout until the book has been measured, so every test needs a
    // measurement to arrive; `mockReturnValue` survives clearAllMocks, so both defaults
    // are restored here rather than set once.
    mockScan(mockEntries.length);
    mockedBuildUnitChain.mockImplementation(singlePages);
    mockedDetectCoverPresence.mockReturnValue(null);
  });

  // Verify that loading flag is true and displayedLayout is null on initialization
  it("should initialize with loading true and displayedLayout null", () => {
    // Both fetches must not resolve so that loading stays true
    mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));
    vi.mocked(ImageUtils.fetchImagePreviewBlob).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() =>
      useViewerController({
        containerPath: "path",
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: { ...mockSettings, enablePreview: true },
        dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      { initialProps: { path: "path1" } },
    );

    await waitFor(() => expect(ImageUtils.createImageCacheItem).toHaveBeenCalled());

    rerender({ path: "path2" });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:full");
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
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
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
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
          entries: longEntries,
          index,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      { initialProps: { index: 0 } },
    );

    // entries[0] is cached as "blob:0".
    await waitFor(() => expect(ImageUtils.createImageCacheItem).toHaveBeenCalled());

    // Navigate within the window (radius = max(preloadPageCount, 5) = 10): entries[0] survives.
    rerender({ index: 5 });
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:0");

    // Navigate far past the window: entries[0] is now evicted and its URL revoked.
    rerender({ index: 50 });
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
  });

  // Verify that displayedLayout is set on successful image loading
  it("should load image and set displayedLayout when successful", async () => {
    const mockLayout: ImageUtils.ViewLayout = {
      nextIndexIncrement: 1,
      isSpread: false,
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
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
      }),
    );

    await waitFor(() => {
      expect(result.current.isImageLoading).toBe(false);
      expect(result.current.displayedLayout).not.toBeNull();
    });

    expect(result.current.displayedLayout).toEqual(mockLayout);
  });

  // Verify that a spread on screen is published to the store for the page list
  it("should dispatch setSpreadDisplayed(true) while a spread is displayed", async () => {
    mockedBuildUnitChain.mockImplementation(spreadPairs);
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({ fullUrl: "url" } as ImageUtils.ImageCacheItem);

    renderHook(() =>
      useViewerController({
        containerPath: "path",
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: { ...mockSettings, isTwoPagedView: true },
        dispatch: mockDispatch,
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
        entries: mockEntries,
        index: 0,
        isSpreadShifted: false,
        settings: mockSettings,
        dispatch: mockDispatch,
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
          entries: mockEntries,
          index,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that action is not dispatched if the next page is out of bounds
    it("should not dispatch if next index is out of bounds", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
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
          entries: [],
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      );
      result.current.moveForward();
      expectNoPageMove();
    });

    // Verify that the forward boundary callback fires at the last page (instead of dispatching)
    it("should call onForwardBoundary at the last page", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      const onForwardBoundary = vi.fn();

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          onForwardBoundary,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveForward();
      expectNoPageMove();
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
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveBack();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
    });

    // Verify that action is not dispatched when moving back from the first page (index 0)
    it("should not dispatch if current index is 0", async () => {
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
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
          entries: [],
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      );
      result.current.moveBack();
      expectNoPageMove();
    });

    // Verify that the backward boundary callback fires at the first page (instead of dispatching)
    it("should call onBackwardBoundary at the first page", () => {
      const onBackwardBoundary = vi.fn();
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
          onForwardBoundary: undefined,
          onBackwardBoundary,
        }),
      );

      result.current.moveBack();
      expectNoPageMove();
      expect(onBackwardBoundary).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    // Verify that loading flag becomes false on image acquisition failure
    it("should set isImageLoading to false when fetch fails", async () => {
      mockedFetchImageBlob.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: mockSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      expect(result.current.displayedLayout).toBeNull();
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
      vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
      vi.mocked(getImageDimensions).mockResolvedValue([
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
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          twoPagedSettings,
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
          entries: mockEntries,
          index: 1,
          isSpreadShifted: true,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(MEASURED, twoPagedSettings, false),
      );
    });

    // Verify an unshifted book takes cover presence straight from the setting
    it("builds the chain with the configured cover presence", async () => {
      mockChain({ 0: 1, 1: 2 });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 1,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          twoPagedSettings,
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
          entries: mockEntries,
          index: 1,
          isSpreadShifted: true,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() =>
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          MEASURED,
          twoPagedSettings,
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
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
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
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
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
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
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
      vi.mocked(getImageDimensions).mockRejectedValue(new Error("scan failed"));

      try {
        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
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
          twoPagedSettings,
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
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
          }),
        );
        await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
        return mockedBuildUnitChain.mock.calls[0];
      };

      expect(await chainFor(0)).toEqual(await chainFor(2));
    });

    // Verify a measured book needs no scan at all
    it("uses the stored measurement instead of scanning", async () => {
      const book = createMockBookWithState({ landscape_bits: "010" });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
          book,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      expect(getImageDimensions).not.toHaveBeenCalled();
      expect(mockedBuildUnitChain).toHaveBeenCalledWith([false, true, false], twoPaged, false);
    });

    // Verify bits that cannot describe this book are re-measured rather than trusted
    it("re-measures when the stored bits do not fit the book", async () => {
      const book = createMockBookWithState({ landscape_bits: "01" });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
          book,
        }),
      );

      await waitFor(() => expect(getImageDimensions).toHaveBeenCalled());
    });

    // Verify a fresh measurement is stored, once, so the next open needs no scan
    it("writes a completed scan back exactly once", async () => {
      const book = createMockBookWithState({ landscape_bits: null });
      vi.mocked(getImageDimensions).mockResolvedValue([
        { width: 100, height: 200 },
        { width: 200, height: 100 },
        { width: 100, height: 200 },
      ]);

      const { rerender } = renderHook(
        ({ book }) =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            book,
          }),
        { initialProps: { book } },
      );

      await waitFor(() => expect(updatePageLayout).toHaveBeenCalledWith(book.id, "010"));

      // The same book arriving as a fresh object — a bookshelf refresh, say — must not
      // make the viewer store the measurement it has already stored.
      rerender({ book: { ...book } });
      await act(async () => {
        await new Promise(process.nextTick);
      });
      expect(vi.mocked(updatePageLayout).mock.calls.length).toBe(1);
    });

    // Verify the viewer shows nothing rather than a pairing it would have to correct
    it("publishes no layout while the book is still being measured", async () => {
      vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
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

    /** Renders with a never-landing scan and lets the wait cap elapse. */
    const afterTheWaitCap = async (settings: ImageUtils.ViewerSettings, shifted = false) => {
      vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 0,
          isSpreadShifted: shifted,
          settings,
          dispatch: mockDispatch,
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
          twoPaged,
          twoPaged.isFirstPageSingleView,
        );
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
          expect.objectContaining({ isFirstPageSingleView: true }),
          true,
        );

        mockedBuildUnitChain.mockClear();
        await afterTheWaitCap({ ...twoPaged, isFirstPageSingleView: false });
        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          expect.objectContaining({ isFirstPageSingleView: false }),
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
          expect.objectContaining({ isFirstPageSingleView: true }),
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 2,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
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
          twoPaged,
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: { ...twoPaged, enablePreview: true },
            dispatch: mockDispatch,
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));
        // Nothing loads, so nothing is known.
        mockedFetchImageBlob.mockReturnValue(new Promise(() => {}));

        await afterTheWaitCap(twoPaged);

        expect(mockedBuildUnitChain).toHaveBeenCalledWith(
          [false, false, false],
          twoPaged,
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));

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
        vi.mocked(getImageDimensions).mockReturnValue(
          new Promise((resolve) => {
            land = resolve;
          }),
        );

        renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
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
        vi.mocked(getImageDimensions).mockReturnValue(new Promise(() => {}));
        renderHook(() =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: twoPaged,
            dispatch: mockDispatch,
            book: createMockBookWithState({ landscape_bits: null }),
          }),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        // It is a display decision, not something measured about the book.
        expect(updatePageLayout).not.toHaveBeenCalled();
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
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPaged,
          dispatch: mockDispatch,
        }),
      );

      // Index 2 sits inside the spread starting at 1, so the viewer snaps to it rather
      // than concluding the reader must have shifted the book.
      await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1)));
      expect(mockedBuildUnitChain.mock.calls.map((call) => call[2])).not.toContain(true);
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: settingsWithPreview,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: settingsWithPreview,
          dispatch: mockDispatch,
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
          entries: mockEntries,
          index: 0,
          isSpreadShifted: false,
          settings: settingsWithPreview,
          dispatch: mockDispatch,
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

    // Only PDF can build a preview more cheaply than the page it stands in for. Every
    // other container answers "no preview", and one such answer must settle it for the
    // whole book rather than costing a wasted round trip on every page turn.
    it("stops requesting previews after the container declines one", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };
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
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: settingsWithPreview,
            dispatch: mockDispatch,
          }),
        { initialProps: { index: 0 } },
      );

      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());
      const afterFirstPage = vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length;

      rerender({ index: 1 });
      await waitFor(() => expect(mockedFetchImageBlob).toHaveBeenCalledWith("path", "p2.jpg"));
      await act(async () => {
        await new Promise(process.nextTick);
      });

      expect(vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length).toBe(afterFirstPage);
    });

    // A failed request says nothing about the container, so it must not disable previews.
    it("keeps requesting previews after a failed request", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue(undefined);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "f",
        url: "f",
      } as ImageUtils.ImageCacheItem);

      const { rerender } = renderHook(
        ({ index }: { index: number }) =>
          useViewerController({
            containerPath: "path",
            entries: mockEntries,
            index,
            isSpreadShifted: false,
            settings: settingsWithPreview,
            dispatch: mockDispatch,
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

    // The answer describes one container, so opening another book has to ask again.
    it("asks again after switching containers", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      vi.mocked(ImageUtils.fetchImagePreviewBlob).mockResolvedValue(null);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "f",
        url: "f",
      } as ImageUtils.ImageCacheItem);

      const { rerender } = renderHook(
        ({ path }: { path: string }) =>
          useViewerController({
            containerPath: path,
            entries: mockEntries,
            index: 0,
            isSpreadShifted: false,
            settings: settingsWithPreview,
            dispatch: mockDispatch,
          }),
        { initialProps: { path: "path" } },
      );

      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());
      const afterFirstBook = vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length;

      rerender({ path: "other" });
      await waitFor(() =>
        expect(vi.mocked(ImageUtils.fetchImagePreviewBlob).mock.calls.length).toBeGreaterThan(
          afterFirstBook,
        ),
      );
    });
  });

  // The backend leaves the caller's own pages out of the preload window, so the viewer has
  // to say how many it is fetching itself.
  describe("preload window", () => {
    const renderAt = (settings: ImageUtils.ViewerSettings, index: number) =>
      renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index,
          isSpreadShifted: false,
          settings,
          dispatch: mockDispatch,
        }),
      );

    it("names one page in single-page view", async () => {
      renderAt(mockSettings, 0);

      await waitFor(() => expect(requestPreloadAround).toHaveBeenCalledWith("path", 0, 10, 1));
    });

    it("names both pages in spread view", async () => {
      renderAt({ ...mockSettings, isTwoPagedView: true }, 0);

      await waitFor(() => expect(requestPreloadAround).toHaveBeenCalledWith("path", 0, 10, 2));
    });

    // The last page has nothing beside it, so the viewer loads one page there whatever the
    // setting says — and preload must not be told to skip a page that follows the book.
    it("names one page on the last page of a spread book", async () => {
      renderAt({ ...mockSettings, isTwoPagedView: true }, mockEntries.length - 1);

      await waitFor(() =>
        expect(requestPreloadAround).toHaveBeenCalledWith("path", mockEntries.length - 1, 10, 1),
      );
    });
  });
});
