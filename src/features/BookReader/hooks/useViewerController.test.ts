import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImageDimensions } from "../../../bindings/ContainerCommands";
import type { Image } from "../../../types/Image";
import { setImageIndex, setSpreadDisplayed, setSpreadShifted } from "../slice";
import * as ImageUtils from "../utils/ImageUtils";
import { useViewerController } from "./useViewerController";

vi.mock("../utils/ImageUtils", () => ({
  // Default to null so navigation falls back to advancing by one unless a test overrides it.
  resolveUnit: vi.fn(() => null),
  // Default to null so the fallback path runs unless a test supplies a chain.
  buildUnitChain: vi.fn(() => null),
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
  // Default to null so moveBack exercises the local heuristic unless a test overrides it.
  findPreviousUnitStart: vi.fn(() => null),
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
  const mockedResolveUnit = vi.mocked(ImageUtils.resolveUnit);
  const mockedBuildUnitChain = vi.mocked(ImageUtils.buildUnitChain);
  const mockedDetectCoverPresence = vi.mocked(ImageUtils.detectCoverPresence);
  const mockedFindPreviousUnitStart = vi.mocked(ImageUtils.findPreviousUnitStart);

  /** Makes resolveUnit report a single-page unit for every index. */
  const resolveSinglePages = () => {
    mockedResolveUnit.mockReturnValue({ isSpread: false, nextIndexIncrement: 1 });
  };

  /** Asserts no page move happened, ignoring the spread flag the hook always publishes. */
  const expectNoPageMove = () => {
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: setImageIndex.type }),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.revokeObjectURL = vi.fn();
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
    resolveSinglePages();

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
    mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });
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
    resolveSinglePages();
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
    resolveSinglePages();

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
      resolveSinglePages();

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
      resolveSinglePages();

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
      resolveSinglePages();
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
      resolveSinglePages();

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
      mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });

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

    // Verify that when the current page's unit is unknown (dimensions not known yet),
    // two-page mode advances by 1, never 2, so a page is never permanently skipped.
    it("should advance by 1 when the unit is unknown in two-paged view", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // No unit can be resolved yet (dimensions unknown for the current page).
      mockedResolveUnit.mockReturnValue(null);

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
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that moveForward uses the current page's unit, not a stale displayedLayout
    it("should use the current page's unit for the increment, not stale displayedLayout", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url1",
        url: "url1",
        width: 200,
        height: 100,
      } as ImageUtils.ImageCacheItem);
      // The effect settles displayedLayout as a single page (increment 1).
      mockedResolveUnit.mockReturnValue({ isSpread: false, nextIndexIncrement: 1 });

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
      expect(result.current.displayedLayout?.nextIndexIncrement).toBe(1);

      // The current page is actually a spread (increment 2). moveForward must use this,
      // not the increment-1 displayedLayout captured above.
      mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
    });

    // Verify that dimensions outlive the blob cache so the backward walk keeps working
    it("keeps page dimensions after the blob cache evicts them", async () => {
      const longEntries = Array.from({ length: 20 }, (_, i) => `p${i}`);
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        width: 100,
        height: 200,
        fullUrl: "url",
        url: "url",
      } as ImageUtils.ImageCacheItem);
      mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });

      const { result, rerender } = renderHook(
        ({ index }) =>
          useViewerController({
            containerPath: "path",
            entries: longEntries,
            index,
            isSpreadShifted: false,
            settings: twoPagedSettings,
            dispatch: mockDispatch,
          }),
        { initialProps: { index: 0 } },
      );
      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      // Move far enough that the eviction window drops the first pages' blobs.
      rerender({ index: 16 });
      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      mockedFindPreviousUnitStart.mockClear();
      result.current.moveBack();

      const getDims = mockedFindPreviousUnitStart.mock.calls[0][2];
      expect(getDims(0)).toEqual({ width: 100, height: 200 });
    });

    /** Drives resolveUnit from a per-index map of unit increments. */
    const mockUnitsByIndex = (increments: Record<number, 1 | 2 | null>) => {
      mockedResolveUnit.mockImplementation((i) => {
        const increment = increments[i];
        return increment ? { isSpread: increment === 2, nextIndexIncrement: increment } : null;
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

    // Verify that moveBack lands on the spread start when it ends exactly on the current index
    it("should go back 2 pages when the spread two pages back ends on the current index", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // Chain around index 2: {0,1} {2}
      mockUnitsByIndex({ 0: 2, 1: 2 });

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
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
    });

    // Verify the historical two-pages-back default when no dimensions are known
    it("should fall back to 2 pages back when no unit can be resolved", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockUnitsByIndex({});

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
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
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

    // Verify the fallback reads dimensions, which outlive the blob cache, rather than layouts
    it("should still resolve units for moveBack after the blob cache evicted the pages", async () => {
      const longEntries = Array.from({ length: 20 }, (_, i) => `p${i}`);
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // Chain around index 16: {14,15} {16}
      mockUnitsByIndex({ 14: 2, 15: 2 });

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: longEntries,
          index: 16,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      result.current.moveBack();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(14));
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
      mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });

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

    // Verify moveBack dispatches the unit start found by the forward walk
    it("should dispatch findPreviousUnitStart's result for moveBack when available", async () => {
      const longEntries = ["p1", "p2", "p3", "p4", "p5"];
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        width: 100,
        height: 200,
      } as ImageUtils.ImageCacheItem);
      mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });
      mockedFindPreviousUnitStart.mockReturnValueOnce(2);

      const { result } = renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: longEntries,
          index: 4,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveBack();
      expect(mockedFindPreviousUnitStart).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
    });

    // Verify moveBack falls back to the local heuristic when the walk can't run
    it("should fall back to the local heuristic for moveBack when findPreviousUnitStart returns null", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // findPreviousUnitStart returns null by default (e.g. incomplete dimensions).
      // Chain around index 2: {0} {1} {2}
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

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveBack();
      expect(mockedFindPreviousUnitStart).toHaveBeenCalled();
      // The unit at index 0 does not reach index 2, so index 1 is the preceding unit.
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
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

    beforeEach(() => {
      // mockReturnValue survives clearAllMocks, so reset the default each test.
      mockedDetectCoverPresence.mockReturnValue(null);
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCreateImageCacheItem.mockReturnValue({
        fullUrl: "url",
        url: "url",
        width: 100,
        height: 200,
      } as ImageUtils.ImageCacheItem);
      vi.mocked(getImageDimensions).mockResolvedValue([
        { width: 100, height: 200 },
        { width: 100, height: 200 },
        { width: 100, height: 200 },
      ]);
    });

    // Verify the chain's boundary wins over the walk and the local heuristic
    it("moves back to the chain's previous unit start", async () => {
      // {0} {1,2}
      mockChain({ 0: 1, 1: 2 });
      mockedFindPreviousUnitStart.mockReturnValue(99);

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
      expect(mockedFindPreviousUnitStart).not.toHaveBeenCalled();
    });

    // Verify the chain's unit, not the local rule, drives the forward increment
    it("moves forward by the chain's increment", async () => {
      // {0} {1,2} - the local rule would report a spread at index 0.
      mockChain({ 0: 1, 1: 2 });
      mockedResolveUnit.mockReturnValue({ isSpread: true, nextIndexIncrement: 2 });

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

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      expect(mockedBuildUnitChain.mock.calls.at(-1)?.[2]).toBe(
        !twoPagedSettings.isFirstPageSingleView,
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

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      expect(mockedBuildUnitChain.mock.calls.at(-1)?.[2]).toBe(false);
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

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      expect(mockedBuildUnitChain.mock.calls.at(-1)?.[2]).toBe(
        twoPagedSettings.isFirstPageSingleView,
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

      await waitFor(() => expect(mockedBuildUnitChain).toHaveBeenCalled());
      expect(mockedBuildUnitChain.mock.calls.at(-1)?.[2]).toBe(
        !twoPagedSettings.isFirstPageSingleView,
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

    // Verify a restored page off the natural pairing shifts the book, rather than snapping
    it("shifts the pairing when the restored page is not a unit start", async () => {
      // {0} {1,2} - opening straight onto index 2 means the reader had shifted the pairing.
      mockChain({ 0: 1, 1: 2 });

      renderHook(() =>
        useViewerController({
          containerPath: "path",
          entries: mockEntries,
          index: 2,
          isSpreadShifted: false,
          settings: twoPagedSettings,
          dispatch: mockDispatch,
        }),
      );

      await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setSpreadShifted(true)));
      expect(mockDispatch).not.toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify the shift is considered once per book, so later jumps snap instead
    it("shifts only once per book and snaps afterwards", async () => {
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

      rerender({ index: 2 });
      await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1)));
      expect(mockDispatch).not.toHaveBeenCalledWith(setSpreadShifted(true));
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

      expect(mockDispatch).not.toHaveBeenCalledWith(setSpreadShifted(true));
    });

    // Verify a scan that does not describe this book is ignored
    it("ignores a scan whose length does not match the entries", async () => {
      mockChain({ 0: 2 });
      vi.mocked(getImageDimensions).mockResolvedValue([{ width: 100, height: 200 }]);

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

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveBack();
      // The chain was never built, so the walk (mocked to null) and heuristic decided.
      expect(mockedBuildUnitChain).not.toHaveBeenCalled();
      expect(mockedFindPreviousUnitStart).toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalledWith(setSpreadShifted(true));
    });

    // Verify a failed scan leaves the viewer on the fallback instead of breaking it
    it("keeps working when the scan fails", async () => {
      vi.mocked(getImageDimensions).mockRejectedValue(new Error("scan failed"));
      mockedResolveUnit.mockReturnValue({ isSpread: false, nextIndexIncrement: 1 });

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

      result.current.moveForward();
      expect(mockedBuildUnitChain).not.toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
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
});
