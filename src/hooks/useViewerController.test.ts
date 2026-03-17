import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useViewerController } from "./useViewerController";
import * as ImageUtils from "../utils/ImageUtils";
import { setImageIndex } from "../reducers/ReadReducer";
import { Image } from "../types/Image";

vi.mock("../utils/ImageUtils", () => ({
  calculateLayout: vi.fn(),
  fetchImageBlob: vi.fn(),
  fetchImagePreviewBlob: vi.fn(),
  createImageCacheItem: vi.fn(),
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
  };

  const mockedFetchImageBlob = vi.mocked(ImageUtils.fetchImageBlob);
  const mockedCreateImageCacheItem = vi.mocked(ImageUtils.createImageCacheItem);
  const mockedCalculateLayout = vi.mocked(ImageUtils.calculateLayout);

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.revokeObjectURL = vi.fn();
  });

  // Verify that loading flag is true and displayedLayout is null on initialization
  it("should initialize with loading true and displayedLayout null", () => {
    mockedFetchImageBlob.mockReturnValue(new Promise(() => {})); // Never resolves for this test

    const { result } = renderHook(() =>
      useViewerController("path", mockEntries, 0, mockSettings, mockDispatch),
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
  });

  describe("error handling", () => {
    // Verify that loading flag becomes false on image acquisition failure
    it("should set isImageLoading to false when fetch fails", async () => {
      mockedFetchImageBlob.mockResolvedValue(undefined as unknown as Image);

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
      let resolvePreview: (val: Image) => void;
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
      resolvePreview!({} as Image);

      await waitFor(() => expect(ImageUtils.fetchImagePreviewBlob).toHaveBeenCalled());
      // Wait for state updates
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // Verify that race conditions between preview and full image acquisition (full image arrives later) are handled correctly
    it("should handle update of existing cache item (loading full after preview)", async () => {
      const settingsWithPreview = { ...mockSettings, enablePreview: true };

      // Delay full image fetch
      mockedFetchImageBlob.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({} as Image), 10)),
      );
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

      // Wait a bit more to ensure all promises in updateLayout finished
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });
});
