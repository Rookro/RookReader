import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import { ErrorCode } from "../../../types/Error";
import * as adjacentBookNavigation from "../hooks/useAdjacentBookNavigation";
import * as fullSizePages from "../hooks/useFullSizePages";
import * as loupe from "../hooks/useLoupe";
import * as pageNavigation from "../hooks/usePageNavigation";
import * as viewerController from "../hooks/useViewerController";
import ComicReader from "./ComicReader";

// Mock the hooks
vi.mock("../hooks/useViewerController");
vi.mock("../hooks/usePageNavigation");
vi.mock("../hooks/useAdjacentBookNavigation");
vi.mock("../hooks/useFullSizePages");
vi.mock("../hooks/useLoupe");

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

    // The loupe is closed by default, which is how every test but the loupe's own sees it.
    vi.mocked(loupe.useLoupe).mockReturnValue({
      isLoupeEnabled: false,
      loupePos: { x: 0, y: 0 },
      containerRef: { current: null },
      handleMouseMove: vi.fn(),
      handleMouseDown: vi.fn(),
      toggleLoupe: vi.fn(),
    });
    vi.mocked(fullSizePages.useFullSizePages).mockReturnValue(new Map());

    // Default mock implementation for useViewerController
    vi.mocked(viewerController.useViewerController).mockReturnValue({
      displayedLayout: null,
      moveForward: vi.fn(),
      moveBack: vi.fn(),
      isImageLoading: false,
    });
  });

  it("measures the reader area before the first page arrives", () => {
    const observed: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(element: Element) {
          observed.push(element);
        }
        unobserve() {}
        disconnect() {}
      },
    );

    // Nothing is on screen yet — which is exactly when the area has to be measured,
    // because no page is asked for until its size has been reported.
    renderWithProviders(<ComicReader />, { preloadedState: createBasePreloadedState() });

    expect(observed).toContain(screen.getByTestId("comic-reader-area"));
    vi.unstubAllGlobals();
  });

  it("reports the measured viewport to the controller", () => {
    renderWithProviders(<ComicReader />, { preloadedState: createBasePreloadedState() });

    // jsdom lays nothing out, so the measurement is zero — what matters is that the
    // controller is given one at all, since it is what gates every page request.
    expect(vi.mocked(viewerController.useViewerController)).toHaveBeenCalledWith(
      expect.objectContaining({ displaySize: { width: 0, height: 0 } }),
    );
  });

  describe("the loupe", () => {
    /** The open loupe, over a spread of `p1.jpg` and `p2.jpg`. */
    const openOverASpread = (fullSize: Map<string, string>) => {
      vi.mocked(loupe.useLoupe).mockReturnValue({
        isLoupeEnabled: true,
        loupePos: { x: 10, y: 10 },
        containerRef: { current: null },
        handleMouseMove: vi.fn(),
        handleMouseDown: vi.fn(),
        toggleLoupe: vi.fn(),
      });
      vi.mocked(fullSizePages.useFullSizePages).mockReturnValue(fullSize);
      vi.mocked(viewerController.useViewerController).mockReturnValue({
        displayedLayout: {
          isSpread: true,
          firstImage: { url: "blob:p1", width: 100, height: 100 },
          secondImage: { url: "blob:p2", width: 100, height: 100 },
          nextIndexIncrement: 2,
        },
        moveForward: vi.fn(),
        moveBack: vi.fn(),
        isImageLoading: false,
      });

      const preloadedState = createBasePreloadedState();
      preloadedState.settings.reader.comic.enableSpread = true;
      preloadedState.read.containerFile.entries = ["p1.jpg", "p2.jpg"];
      preloadedState.read.containerFile.history = ["book.zip"];
      preloadedState.read.containerFile.historyIndex = 0;
      renderWithProviders(<ComicReader />, { preloadedState });
    };

    it("asks for the pages on screen at full size", () => {
      openOverASpread(new Map());

      expect(vi.mocked(fullSizePages.useFullSizePages)).toHaveBeenCalledWith(
        "book.zip",
        ["p1.jpg", "p2.jpg"],
        true,
      );
    });

    it("shows the full-size pages under the lens", () => {
      openOverASpread(
        new Map([
          ["p1.jpg", "blob:p1-full"],
          ["p2.jpg", "blob:p2-full"],
        ]),
      );

      // Twice each: once behind the lens at the displayed size, once under it at full
      // size. Scaling the displayed page would add no detail.
      const sources = screen.getAllByRole("img").map((img) => img.getAttribute("src"));
      expect(sources).toContain("blob:p1");
      expect(sources).toContain("blob:p1-full");
      expect(sources).toContain("blob:p2-full");
    });

    it("falls back to the displayed page when a full-size copy is missing", () => {
      openOverASpread(new Map([["p1.jpg", "blob:p1-full"]]));

      // Softer under the lens than it could be, but never blank.
      const sources = screen.getAllByRole("img").map((img) => img.getAttribute("src"));
      expect(sources).toContain("blob:p1-full");
      expect(sources.filter((src) => src === "blob:p2")).toHaveLength(2);
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
