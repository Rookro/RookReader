import * as fs from "@tauri-apps/plugin-fs";
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockLog, mockStore } from "../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import * as pageNav from "../hooks/usePageNavigation";
import * as ReadReducer from "../slice";
import NovelReader from "./NovelReader";

vi.mock("foliate-js/view.js", () => ({}));

// Mock foliate-js view
class MockView extends HTMLElement {
  book = {
    sections: [{ id: "ch1.html" }],
    toc: [{ label: "Chapter 1", href: "ch1.html" }],
  };
  renderer = {
    next: vi.fn(),
    prev: vi.fn(),
  };
  open = vi.fn().mockResolvedValue(undefined);
  goTo = vi.fn().mockResolvedValue(undefined);
  lastLocation = { index: -1, cfi: "initial" };
}

if (!customElements.get("foliate-view")) {
  customElements.define("foliate-view", MockView);
}

const mockPageNavHandlers = {
  handleClicked: vi.fn(),
  handleContextMenu: vi.fn(),
  handleWheeled: vi.fn(),
  handleKeydown: vi.fn(),
};

vi.mock("../hooks/usePageNavigation", () => ({
  usePageNavigation: vi.fn(() => mockPageNavHandlers),
}));

vi.mock("../slice", async () => {
  const actual = await vi.importActual("../slice");
  return {
    ...actual,
    setEntries: vi.fn((payload: string[]) => ({ type: "read/setEntries", payload })),
    setNovelLocation: vi.fn((payload: { index: number; cfi: string }) => ({
      type: "read/setNovelLocation",
      payload,
    })),
  };
});

describe("BookReader/NovelReader", () => {
  const mockFilePath = "/path/to/novel.epub";
  const defaultPreloadedState = createBasePreloadedState();
  defaultPreloadedState.read.containerFile = {
    ...defaultPreloadedState.read.containerFile,
    history: [mockFilePath],
    historyIndex: 0,
    index: 0,
    cfi: null,
    isNovel: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.get.mockResolvedValue(null);
    vi.mocked(fs.readFile).mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("should load the EPUB file and initialize foliate-view", async () => {
    const { container } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    expect(fs.readFile).toHaveBeenCalledWith(mockFilePath);

    await waitFor(() => {
      const view = container.querySelector("foliate-view") as unknown as MockView;
      expect(view?.open).toHaveBeenCalled();
    });
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("should dispatch entries when book is loaded", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ReadReducer.setEntries).toHaveBeenCalledWith(["Chapter 1"]));
  });

  it("should log error when readFile fails", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("Disk error"));
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() =>
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.stringContaining("Error loading EPUB file: Error: Disk error"),
      ),
    );
  });

  it("should handle relocation events", async () => {
    const { container } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      const view = container.querySelector("foliate-view") as unknown as MockView;
      expect(view?.open).toHaveBeenCalled();
    });

    const view = container.querySelector("foliate-view") as HTMLElement;

    act(() => {
      const relocateEvent = new CustomEvent("relocate", {
        detail: { section: { current: 5 }, cfi: "epubcfi(5)" },
      });
      view.dispatchEvent(relocateEvent);
    });
    expect(ReadReducer.setNovelLocation).toHaveBeenCalledWith({ index: 5, cfi: "epubcfi(5)" });
  });

  it("should handle load events and apply styles", async () => {
    const { container } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      const view = container.querySelector("foliate-view") as unknown as MockView;
      expect(view?.open).toHaveBeenCalled();
    });

    const view = container.querySelector("foliate-view") as HTMLElement;
    const mockDoc = document.implementation.createHTMLDocument();

    act(() => {
      const loadEvent = new CustomEvent("load", {
        detail: { doc: mockDoc, index: 0 },
      });
      view.dispatchEvent(loadEvent);
    });

    expect(mockDoc.getElementById("novel-reader-theme")).toBeTruthy();
  });

  it("should display specific cfi if provided in state", async () => {
    const cfiState = {
      ...defaultPreloadedState,
      read: {
        ...defaultPreloadedState.read,
        containerFile: { ...defaultPreloadedState.read.containerFile, cfi: "epubcfi(target)" },
      },
    };

    const { container } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: cfiState,
    });

    await waitFor(() => {
      const view = container.querySelector("foliate-view") as unknown as MockView;
      expect(view?.open).toHaveBeenCalled();
      expect(view?.goTo).toHaveBeenCalledWith("epubcfi(target)");
    });
  });

  it("should handle page navigation clicks inside document", async () => {
    const { container } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      const view = container.querySelector("foliate-view") as unknown as MockView;
      expect(view?.open).toHaveBeenCalled();
    });

    const view = container.querySelector("foliate-view") as HTMLElement;
    const mockDoc = document.implementation.createHTMLDocument();

    act(() => {
      const loadEvent = new CustomEvent("load", {
        detail: { doc: mockDoc, index: 0 },
      });
      view.dispatchEvent(loadEvent);
    });

    act(() => {
      const clickEvent = new MouseEvent("click", { bubbles: true });
      mockDoc.body.dispatchEvent(clickEvent);
    });

    expect(mockPageNavHandlers.handleClicked).toHaveBeenCalled();
  });

  it("should move forward and backward", async () => {
    const { container } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      const view = container.querySelector("foliate-view") as unknown as MockView;
      expect(view?.open).toHaveBeenCalled();
    });

    const pageNavCall = vi.mocked(pageNav.usePageNavigation).mock.calls[0];
    const forward = pageNavCall[0];
    const back = pageNavCall[1];

    const view = container.querySelector("foliate-view") as unknown as MockView;

    act(() => {
      forward();
    });
    expect(view.renderer.next).toHaveBeenCalled();

    act(() => {
      back();
    });
    expect(view.renderer.prev).toHaveBeenCalled();
  });
});
