import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Image } from "../../../types/Image";
import { setImageIndex } from "../slice";
import * as ImageUtils from "../utils/ImageUtils";
import { useViewerController } from "./useViewerController";

vi.mock("../utils/ImageUtils", () => ({
  calculateLayout: vi.fn(),
  fetchImageBlob: vi.fn(),
  fetchImagePreviewBlob: vi.fn(),
  createImageCacheItem: vi.fn(),
  buildSinglePageLayout: vi.fn((firstImage) => ({
    firstImage,
    isSpread: false,
    nextIndexIncrement: 1,
  })),
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
  const mockedCalculateLayout = vi.mocked(ImageUtils.calculateLayout);
  const mockedFindPreviousUnitStart = vi.mocked(ImageUtils.findPreviousUnitStart);

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
      useViewerController(
        "path",
        mockEntries,
        0,
        { ...mockSettings, enablePreview: true },
        mockDispatch,
      ),
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
        useViewerController(path, mockEntries, 0, mockSettings, mockDispatch),
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
      useViewerController("path", mockEntries, 0, mockSettings, mockDispatch),
    );

    await waitFor(() => expect(ImageUtils.createImageCacheItem).toHaveBeenCalled());

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:full");
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
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
    mockedCalculateLayout.mockReturnValue(mockLayout);

    const { result } = renderHook(() =>
      useViewerController("path", mockEntries, 0, mockSettings, mockDispatch),
    );

    await waitFor(() => {
      expect(result.current.isImageLoading).toBe(false);
      expect(result.current.displayedLayout).not.toBeNull();
    });

    expect(result.current.displayedLayout).toEqual(mockLayout);
  });

  // Verify that fetching is not performed for images that are already cached
  it("should handle already cached images", async () => {
    const mockLayout: ImageUtils.ViewLayout = {
      nextIndexIncrement: 1,
      isSpread: false,
      firstImage: { url: "url1" } as ImageUtils.ImageCacheItem,
    };
    mockedFetchImageBlob.mockResolvedValue({} as Image);
    mockedCreateImageCacheItem.mockReturnValue({
      fullUrl: "url1",
      url: "url1",
    } as ImageUtils.ImageCacheItem);
    mockedCalculateLayout.mockReturnValue(mockLayout);

    const { result, rerender } = renderHook(
      ({ index }: { index: number }) =>
        useViewerController("path", mockEntries, index, mockSettings, mockDispatch),
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
      mockedCalculateLayout.mockReturnValue(mockLayout);

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 0, mockSettings, mockDispatch),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that action is not dispatched if the next page is out of bounds
    it("should not dispatch if next index is out of bounds", async () => {
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
      mockedCalculateLayout.mockReturnValue(mockLayout);

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, mockSettings, mockDispatch),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    // Verify that moving forward does nothing if entries are empty
    it("should do nothing if entries are empty", () => {
      const { result } = renderHook(() =>
        useViewerController("path", [], 0, mockSettings, mockDispatch),
      );
      result.current.moveForward();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    // Verify that the forward boundary callback fires at the last page (instead of dispatching)
    it("should call onForwardBoundary at the last page", async () => {
      const mockLayout: ImageUtils.ViewLayout = {
        nextIndexIncrement: 1,
        isSpread: false,
        firstImage: { url: "url1", width: 100, height: 100 } as ImageUtils.ImageCacheItem,
      };
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCalculateLayout.mockReturnValue(mockLayout);
      const onForwardBoundary = vi.fn();

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, mockSettings, mockDispatch, onForwardBoundary),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveForward();
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(onForwardBoundary).toHaveBeenCalledTimes(1);
    });
  });

  describe("moveBack", () => {
    // Verify that index update action is dispatched correctly when moving to the previous page
    it("should dispatch setImageIndex with previous index", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCalculateLayout.mockReturnValue({
        nextIndexIncrement: 1,
        isSpread: false,
        firstImage: {
          url: "url1",
          width: 100,
          height: 100,
          fullUrl: "url1",
        } as ImageUtils.ImageCacheItem,
      });

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 1, mockSettings, mockDispatch),
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
        useViewerController("path", mockEntries, 0, mockSettings, mockDispatch),
      );

      result.current.moveBack();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    // Verify that moving back does nothing if entries are empty
    it("should handle moveBack when entries are empty", () => {
      const { result } = renderHook(() =>
        useViewerController("path", [], 0, mockSettings, mockDispatch),
      );
      result.current.moveBack();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    // Verify that the backward boundary callback fires at the first page (instead of dispatching)
    it("should call onBackwardBoundary at the first page", () => {
      const onBackwardBoundary = vi.fn();
      const { result } = renderHook(() =>
        useViewerController(
          "path",
          mockEntries,
          0,
          mockSettings,
          mockDispatch,
          undefined,
          onBackwardBoundary,
        ),
      );

      result.current.moveBack();
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(onBackwardBoundary).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    // Verify that loading flag becomes false on image acquisition failure
    it("should set isImageLoading to false when fetch fails", async () => {
      mockedFetchImageBlob.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 0, mockSettings, mockDispatch),
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
    it("should increment index by 2 when displayedLayout suggests spread", async () => {
      const mockLayout: ImageUtils.ViewLayout = {
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: {
          url: "url1",
          width: 100,
          height: 100,
          fullUrl: "url1",
        } as ImageUtils.ImageCacheItem,
        secondImage: {
          url: "url2",
          width: 100,
          height: 100,
          fullUrl: "url2",
        } as ImageUtils.ImageCacheItem,
      };
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCalculateLayout.mockReturnValue(mockLayout);

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 0, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
    });

    // Verify that when the current page's layout is unknown (image not cached yet),
    // two-page mode advances by 1, never 2, so a page is never permanently skipped.
    it("should advance by 1 when the layout is unknown in two-paged view", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // No layout can be resolved yet (cache miss for the current page).
      mockedCalculateLayout.mockReturnValue(null);

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 0, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that moveForward uses the current page's layout, not a stale displayedLayout
    it("should use the current page's layout for the increment, not stale displayedLayout", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      // The effect settles displayedLayout as a single page (increment 1).
      mockedCalculateLayout.mockReturnValue({
        nextIndexIncrement: 1,
        isSpread: false,
        firstImage: { width: 200, height: 100 } as ImageUtils.ImageCacheItem,
      });

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 0, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      expect(result.current.displayedLayout?.nextIndexIncrement).toBe(1);

      // The current page is actually a spread (increment 2). moveForward must use this,
      // not the increment-1 displayedLayout captured above.
      mockedCalculateLayout.mockReturnValue({
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
        secondImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
      });

      result.current.moveForward();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
    });

    // Verify that index goes back appropriately based on landscape image detection in two-paged view
    it("should handle moveBack in two-paged view with landscape detection", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      // Current layout (index 2)
      mockedCalculateLayout.mockReturnValueOnce({
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: { width: 100, height: 100 } as ImageUtils.ImageCacheItem,
      });

      // Simulation for 1 page back (index 1) - Landscape
      mockedCalculateLayout.mockReturnValueOnce({
        nextIndexIncrement: 1,
        isSpread: false,
        firstImage: { width: 200, height: 100 } as ImageUtils.ImageCacheItem, // Landscape
      });

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveBack();
      // Should go back 1 page because index 1 is landscape
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(1));
    });

    // Verify that index goes back appropriately based on portrait image detection in two-paged view
    it("should handle moveBack in two-paged view with portrait detection", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);

      // Current layout (index 2)
      mockedCalculateLayout.mockReturnValueOnce({
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: { width: 100, height: 100 } as ImageUtils.ImageCacheItem,
      });

      // Simulation for 1 page back (index 1) - Portrait
      mockedCalculateLayout.mockReturnValueOnce({
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
      });

      // Simulation for 2 pages back (index 0) - Portrait
      mockedCalculateLayout.mockReturnValueOnce({
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
      });

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => {
        expect(result.current.isImageLoading).toBe(false);
      });

      result.current.moveBack();
      // Should go back 2 pages
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
    });

    // Verify that moving back falls back to 2 pages if layout calculation fails
    it("should fallback to 2 pages back if layout calculation fails for moveBack", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCalculateLayout
        .mockReturnValueOnce({} as ImageUtils.ViewLayout) // current
        .mockReturnValueOnce({
          nextIndexIncrement: 2,
          isSpread: true,
          firstImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
        } as ImageUtils.ViewLayout) // 1 page back (portrait)
        .mockReturnValueOnce(null); // 2 pages back fails

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));
      result.current.moveBack();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(0));
    });

    // Verify that moving back goes 1 page if the entry 2 pages back is a landscape image
    it("should go back 1 page if 2 pages back is landscape", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      mockedCalculateLayout
        .mockReturnValueOnce({} as ImageUtils.ViewLayout) // current
        .mockReturnValueOnce({
          nextIndexIncrement: 2,
          isSpread: true,
          firstImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
        } as ImageUtils.ViewLayout) // 1 page back (portrait)
        .mockReturnValueOnce({
          nextIndexIncrement: 1,
          isSpread: false,
          firstImage: { width: 200, height: 100 } as ImageUtils.ImageCacheItem,
        } as ImageUtils.ViewLayout); // 2 pages back (landscape)

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, twoPagedSettings, mockDispatch),
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
      // A spread cannot form while the second page is missing.
      mockedCalculateLayout.mockReturnValue(null);

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 0, twoPagedSettings, mockDispatch),
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
      mockedCalculateLayout.mockReturnValue({
        nextIndexIncrement: 2,
        isSpread: true,
        firstImage: { width: 100, height: 200 } as ImageUtils.ImageCacheItem,
      });
      mockedFindPreviousUnitStart.mockReturnValueOnce(2);

      const { result } = renderHook(() =>
        useViewerController("path", longEntries, 4, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveBack();
      expect(mockedFindPreviousUnitStart).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(setImageIndex(2));
    });

    // Verify moveBack falls back to the local heuristic when the walk can't run
    it("should fall back to the local heuristic for moveBack when findPreviousUnitStart returns null", async () => {
      mockedFetchImageBlob.mockResolvedValue({} as Image);
      // findPreviousUnitStart returns null by default (e.g. incomplete cache).
      mockedCalculateLayout
        .mockReturnValueOnce({
          nextIndexIncrement: 2,
          isSpread: true,
          firstImage: { width: 100, height: 100 } as ImageUtils.ImageCacheItem,
        }) // current (effect)
        .mockReturnValueOnce({
          nextIndexIncrement: 1,
          isSpread: false,
          firstImage: { width: 200, height: 100 } as ImageUtils.ImageCacheItem,
        }); // 1 page back (landscape)

      const { result } = renderHook(() =>
        useViewerController("path", mockEntries, 2, twoPagedSettings, mockDispatch),
      );

      await waitFor(() => expect(result.current.isImageLoading).toBe(false));

      result.current.moveBack();
      expect(mockedFindPreviousUnitStart).toHaveBeenCalled();
      // Heuristic: the page 1 step back is landscape → go back one page.
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
        useViewerController("path", mockEntries, 0, settingsWithPreview, mockDispatch),
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
        useViewerController("path", mockEntries, 0, settingsWithPreview, mockDispatch),
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
        useViewerController("path", mockEntries, 0, settingsWithPreview, mockDispatch),
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
  });
});
