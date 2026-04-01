import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import ComicReader from "./ComicReader";
import * as viewerController from "../hooks/useViewerController";
import * as pageNavigation from "../hooks/usePageNavigation";

// Mock the hooks
vi.mock("../hooks/useViewerController");
vi.mock("../hooks/usePageNavigation");

describe("ComicReader", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for usePageNavigation
    vi.mocked(pageNavigation.usePageNavigation).mockReturnValue({
      handleClicked: vi.fn(),
      handleContextMenu: vi.fn(),
      handleWheeled: vi.fn(),
      handleKeydown: vi.fn(),
    });

    // Default mock implementation for useViewerController
    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: null,
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });
  });

  it("should show CircularProgress when loading", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.isLoading = true;

    renderWithProviders(<ComicReader />, { preloadedState });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should render a single page layout correctly", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.enableSpread = false;

    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: {
        isSpread: false,
        firstImage: { url: "blob:p1", width: 100, height: 100 },
        nextIndexIncrement: 1,
      },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState });

    const img = screen.getByAltText("Single Page");
    expect(img).toHaveAttribute("src", "blob:p1");
  });

  it("should render a spread layout in LTR correctly", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.readingDirection = "ltr";
    preloadedState.settings.reader.comic.enableSpread = true;

    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: {
        isSpread: true,
        firstImage: { url: "blob:p1", width: 100, height: 100 }, // In LTR, first is left
        secondImage: { url: "blob:p2", width: 100, height: 100 }, // second is right
        nextIndexIncrement: 2,
      },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState });

    const leftImg = screen.getByAltText("Left Page");
    const rightImg = screen.getByAltText("Right Page");

    expect(leftImg).toHaveAttribute("src", "blob:p1");
    expect(rightImg).toHaveAttribute("src", "blob:p2");
  });

  it("should render a spread layout in RTL correctly", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.readingDirection = "rtl";
    preloadedState.settings.reader.comic.enableSpread = true;

    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: {
        isSpread: true,
        firstImage: { url: "blob:p1", width: 100, height: 100 }, // In RTL, first is right
        secondImage: { url: "blob:p2", width: 100, height: 100 }, // second is left
        nextIndexIncrement: 2,
      },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState });

    const leftImg = screen.getByAltText("Left Page");
    const rightImg = screen.getByAltText("Right Page");

    // RTL logic in ComicReader:
    // srcLeft = secondImage?.url || firstImage?.url = blob:p2
    // srcRight = firstImage?.url = blob:p1
    expect(leftImg).toHaveAttribute("src", "blob:p2");
    expect(rightImg).toHaveAttribute("src", "blob:p1");
  });

  it("should call handleClicked when clicked", async () => {
    const handleClicked = vi.fn();
    vi.mocked(pageNavigation.usePageNavigation).mockReturnValue({
      handleClicked,
      handleContextMenu: vi.fn(),
      handleWheeled: vi.fn(),
      handleKeydown: vi.fn(),
    });

    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: {
        isSpread: false,
        firstImage: { url: "blob:p1", width: 100, height: 100 },
        nextIndexIncrement: 1,
      },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />);

    // Click on the container Box
    const container = screen.getByAltText("Single Page").parentElement!;
    await user.click(container);

    expect(handleClicked).toHaveBeenCalled();
  });
});
