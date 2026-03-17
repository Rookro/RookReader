import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithProviders, RootState } from "../../test/utils";
import BookReader from "./BookReader";
import { mockStore } from "../../test/mocks/tauri";
import * as bookCmds from "../../bindings/BookCommands";
import * as containerCmds from "../../bindings/ContainerCommands";
import * as dragDrop from "../../hooks/useDragDropEvent";
import * as readRed from "../../reducers/ReadReducer";
import { error } from "@tauri-apps/plugin-log";

// Module-level mocks to bypass lazy loading
vi.mock("../SidePane/SideTabs", () => ({ default: () => <div data-testid="side-tabs" /> }));
vi.mock("../SidePane/SidePanels", () => ({ default: () => <div data-testid="side-panels" /> }));
vi.mock("./ControlSlider", () => ({ default: () => <div data-testid="control-slider" /> }));
vi.mock("./NavigationBar", () => ({ default: () => <div data-testid="navigation-bar" /> }));
vi.mock("./FileNavigator/FileNavigator", () => ({ default: () => <div /> }));
vi.mock("./ImageEntriesViewer/ImageEntriesViewer", () => ({ default: () => <div /> }));
vi.mock("./HistoryViewer/HistoryViewer", () => ({ default: () => <div /> }));
vi.mock("./ComicReader", () => ({ default: () => <div data-testid="comic-reader" /> }));
vi.mock("./NovelReader", () => ({ default: () => <div data-testid="novel-reader" /> }));

vi.mock("../../hooks/useDragDropEvent", () => ({
  useDragDropEvent: vi.fn(),
}));

vi.mock("../../reducers/ReadReducer", async () => {
  const actual = (await vi.importActual("../../reducers/ReadReducer")) as Record<string, unknown>;
  return {
    ...actual,
    openContainerFile: vi.fn(() => ({ type: "read/openContainerFile" })),
    setContainerFilePath: vi.fn((p: string) => ({ type: "read/setContainerFilePath", payload: p })),
  };
});

vi.mock("../../bindings/ContainerCommands", async () => {
  const actual = (await vi.importActual("../../bindings/ContainerCommands")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    setPdfRenderingHeight: vi.fn(() => Promise.resolve()),
  };
});

describe("BookReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockStore.get.mockImplementation((key) => {
      if (key === "first-page-single-view") return Promise.resolve(true);
      if (key === "rendering")
        return Promise.resolve({ "enable-preview": true, "pdf-rendering-height": 2000 });
      if (key === "history")
        return Promise.resolve({ enable: true, "restore-last-container-on-startup": false });
      return Promise.resolve(null);
    });
  });

  it("should render main sub-components", async () => {
    renderWithProviders(<BookReader />);
    await waitFor(() => expect(screen.getByTestId("navigation-bar")).toBeInTheDocument());
    expect(screen.getByTestId("control-slider")).toBeInTheDocument();
    await waitFor(() => {
      expect(containerCmds.setPdfRenderingHeight).toHaveBeenCalledWith(2000);
    });
  });

  it("should restore last container on startup if enabled", async () => {
    mockStore.get.mockImplementation((key) => {
      if (key === "history")
        return Promise.resolve({ enable: true, "restore-last-container-on-startup": true });
      return Promise.resolve(null);
    });

    vi.mocked(bookCmds.getRecentlyReadBooks).mockResolvedValue([
      {
        id: 1,
        file_path: "/last/book.zip",
        display_name: "Last Book",
        total_pages: 100,
        item_type: "file",
        last_read_page_index: 0,
        series_id: null,
        series_order: null,
        thumbnail_path: null,
        last_opened_at: "",
      },
    ]);

    renderWithProviders(<BookReader />);
    await waitFor(() =>
      expect(readRed.setContainerFilePath).toHaveBeenCalledWith("/last/book.zip"),
    );
  });

  it("should handle empty history during startup restoration", async () => {
    mockStore.get.mockImplementation((key) => {
      if (key === "history")
        return Promise.resolve({ enable: true, "restore-last-container-on-startup": true });
      return Promise.resolve(null);
    });

    vi.mocked(bookCmds.getRecentlyReadBooks).mockResolvedValue([]);

    renderWithProviders(<BookReader />);
    await waitFor(() => expect(bookCmds.getRecentlyReadBooks).toHaveBeenCalled());
    expect(readRed.setContainerFilePath).not.toHaveBeenCalled();
  });

  it("should update container when a file is dropped", async () => {
    const preloadedState = {
      view: {
        activeView: "reader" as const,
        enableHistory: true,
        direction: "ltr",
        novel: { font: "default", fontSize: 16 },
      },
      read: {
        containerFile: {
          history: [],
          historyIndex: -1,
          entries: [],
          index: 0,
          isNovel: false,
          isLoading: false,
          isDirectory: false,
          book: null,
          cfi: null,
          error: null,
        },
        explorer: {
          history: [],
          historyIndex: -1,
          entries: [],
          searchText: "",
          sortOrder: "name-asc",
          isLoading: false,
          isWatchEnabled: false,
          error: null,
        },
      },
      sidePane: {
        left: { isHidden: false, tabIndex: 0 },
      },
    } as unknown as RootState;

    renderWithProviders(<BookReader />, { preloadedState });

    await waitFor(() => expect(dragDrop.useDragDropEvent).toHaveBeenCalled());
    const dropHandler = (
      vi.mocked(dragDrop.useDragDropEvent).mock.calls[0][0] as { onDrop: (paths: string[]) => void }
    ).onDrop;

    act(() => {
      dropHandler?.(["/dropped/file.zip"]);
    });
    await waitFor(() => {
      expect(readRed.setContainerFilePath).toHaveBeenCalledWith("/dropped/file.zip");
    });
  });

  it("should save pane sizes to localStorage on change", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    renderWithProviders(<BookReader />);

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        "book-reader-left-pane-sizes",
        JSON.stringify([100, 900]),
      );
    });
  });

  it("should handle malformed localStorage data", () => {
    localStorage.setItem("book-reader-left-pane-sizes", "invalid-json");
    renderWithProviders(<BookReader />);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse book-reader-left-pane-sizes"),
    );
  });

  it("should ignore non-array or non-number array in localStorage", () => {
    localStorage.setItem("book-reader-left-pane-sizes", JSON.stringify({ not: "array" }));
    renderWithProviders(<BookReader />);

    localStorage.setItem("book-reader-left-pane-sizes", JSON.stringify(["not", "numbers"]));
    renderWithProviders(<BookReader />);
  });
});
