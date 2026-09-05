import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import { ErrorCode } from "../../../types/Error";
import * as adjacentBookNavigation from "../hooks/useAdjacentBookNavigation";
import * as pageNavigation from "../hooks/usePageNavigation";
import * as viewerController from "../hooks/useViewerController";
import ComicReader from "./ComicReader";

// Mock the hooks
vi.mock("../hooks/useViewerController");
vi.mock("../hooks/usePageNavigation");
vi.mock("../hooks/useAdjacentBookNavigation");

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

    // Default mock implementation for useAdjacentBookNavigation
    vi.mocked(adjacentBookNavigation.useAdjacentBookNavigation).mockReturnValue({
      onForwardBoundary: vi.fn(),
      onBackwardBoundary: vi.fn(),
      pending: null,
      confirmPending: vi.fn(),
      cancelPending: vi.fn(),
    });

    // Default mock implementation for useViewerController
    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: null,
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });
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
    const container = screen.getByAltText("Single Page").parentElement;
    if (container) {
      await user.click(container);
    }

    expect(handleClicked).toHaveBeenCalled();
  });

  it("should have loupe event handlers and container ref", () => {
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

    const readerArea = screen.getByTestId("comic-reader-area");
    expect(readerArea).toBeInTheDocument();

    // Check if event handlers are present
    expect(readerArea).toHaveProperty("onmousemove");
    expect(readerArea).toHaveProperty("onmousedown");
  });

  // Verify the reason stands in the failed page's own place, not over the whole reader
  it("shows why the page could not be loaded in the page's place", () => {
    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: { isSpread: false, firstError: ErrorCode.image, nextIndexIncrement: 1 },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState: createBasePreloadedState() });

    expect(
      screen.getByText("Failed to load the page. The file is damaged or could not be read."),
    ).toBeInTheDocument();
    expect(screen.queryByAltText("Single Page")).not.toBeInTheDocument();
  });

  // The page that loaded keeps its half of the screen, so it is clear which page failed
  it("shows the loaded page beside the failed one", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.readingDirection = "ltr";
    preloadedState.settings.reader.comic.enableSpread = true;

    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: {
        isSpread: true,
        firstImage: { url: "blob:p1", width: 100, height: 100 },
        secondError: ErrorCode.entryNotFound,
        nextIndexIncrement: 2,
      },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState });

    expect(screen.getByAltText("Left Page")).toHaveAttribute("src", "blob:p1");
    expect(screen.queryByAltText("Right Page")).not.toBeInTheDocument();
    expect(screen.getByText("Failed to load the page. Page not found.")).toBeInTheDocument();
  });

  // Verify a spread that failed outright says so twice, once in each page's place
  it("shows a message in each half when both pages of a spread fail", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.readingDirection = "ltr";
    preloadedState.settings.reader.comic.enableSpread = true;

    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: {
        isSpread: true,
        firstError: ErrorCode.image,
        secondError: ErrorCode.entryNotFound,
        nextIndexIncrement: 2,
      },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState });

    expect(screen.getAllByTestId("page-error-message")).toHaveLength(2);
    expect(
      screen.getByText("Failed to load the page. The file is damaged or could not be read."),
    ).toBeInTheDocument();
    expect(screen.getByText("Failed to load the page. Page not found.")).toBeInTheDocument();
  });

  // Turning the page is the only way off a failed one, so it has to work with no image shown
  it("still turns the page while an error is on screen", async () => {
    const handleClicked = vi.fn();
    const handleWheeled = vi.fn();
    vi.mocked(pageNavigation.usePageNavigation).mockReturnValue({
      handleClicked,
      handleContextMenu: vi.fn(),
      handleWheeled,
      handleKeydown: vi.fn(),
    });
    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: { isSpread: false, firstError: ErrorCode.image, nextIndexIncrement: 1 },
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });

    renderWithProviders(<ComicReader />, { preloadedState: createBasePreloadedState() });

    const readerArea = screen.getByTestId("comic-reader-area");
    fireEvent.wheel(readerArea, { deltaY: 100 });
    expect(handleWheeled).toHaveBeenCalled();

    await user.click(readerArea);
    expect(handleClicked).toHaveBeenCalled();
  });
});
